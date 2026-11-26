import {type Entry, type Linkable, type TimeseriesList} from "../lists";
import {DateUtils, ElementUtils, StringUtils} from "../util";

export class OutputWindow {
	window: HTMLDivElement;
	lastUpdatedText: HTMLParagraphElement;
	citationCache: Record<string, number>;

	constructor(windowID: string, lastUpdatedID: string) {
		this.window = ElementUtils.getElementOrThrow<HTMLDivElement>(windowID);
		this.lastUpdatedText = ElementUtils.getElementOrThrow<HTMLParagraphElement>(lastUpdatedID);
		this.citationCache = {};

		window.addEventListener("error", (error) => this.logError(error));
		window.addEventListener("unhandledrejection", (error) => this.logError(error));

		window.addEventListener("list-change", (e) => {
			if (!(e instanceof CustomEvent)) throw new Error("Custom event listener did not receive a CustomEvent.");
			const listSelection = e.detail?.selection ?? "";
			if (listSelection == "From URL") this.write("[Waiting for URL...]");
			else if (listSelection == "From File Upload") this.write("[Waiting for file upload...]");
		});
	}

	blank(mode: "window" | "lastUpdated" | "both" = "both"): void {
		if (mode != "lastUpdated") this.window.innerHTML = "";
		if (mode != "window") this.lastUpdatedText.innerHTML = "";
	}

	write(message: string, append: boolean = false): void {
		if (message.startsWith("<")) {
			// Assume message is HTML
			this.window.innerHTML = (append ? this.window.innerHTML : "") + message;
		} else {
			// Assume message is text
			this.window.innerHTML = (append ? this.window.innerHTML : "") + `
				<p class="should-fade-in list-name">
					${message}
				</p>
			`;
		}
		
		if (!append) {
			this.lastUpdatedText.innerText = "";
			this.citationCache = {};
		}
	}

	static #printLinkable<T extends Linkable>(linkable: T): string {
		if (!linkable.url) return linkable.name;
		return `<a href="${linkable.url}" title="${linkable.url}">${linkable.name ? linkable.name : linkable.url}</a>`;
	}

	#toCitations(sources: string[]): string {
		let citations = "";
		for (const source of sources) {
			let cachedCitation = this.citationCache[source];
			if (cachedCitation === undefined) {
				cachedCitation = Object.keys(this.citationCache).length + 1
				this.citationCache[source] = cachedCitation;
			}
			citations += `<sup>${OutputWindow.#printLinkable({
				name: `[${cachedCitation}]`,
				url: source
			})}</sup>`;
		}
		return citations;
	}

	logError(error: ErrorEvent | PromiseRejectionEvent): void {
		// Data related to the error object itself
		const errorData = {
			"Message": error instanceof ErrorEvent ? error.message : error.reason,
			"Error type": error.type,
			"File": error instanceof ErrorEvent ? error.filename : "[Unknown]",
			"Line number": error instanceof ErrorEvent ? error.lineno : "[Unknown]",
			"Column number": error instanceof ErrorEvent ? error.colno : "[Unknown]",
			"Stack trace": error instanceof ErrorEvent ? (
				"stack" in error ?
				error.stack :
				"stack" in error.error ?
					error.error.stack :
					"[Unsupported]"
			) : (
				error.reason.stack ?? "[Unsupported]"
			)
		};
		// Data related to the surrounding page environment.
		const environmentData = {
			"Build version": import.meta.env.VITE_PACKAGE_VERSION ?? "[Unknown]",
			"Build type": import.meta.env.MODE ?? "[Unknown]"
		};
		// The current state of the application.
		const currentConfigurationData = {
			/* TODO: These should be replaced with references to the corresponding components, especially
			   because the mapped list external reference, etc. should also be displayed as well. */
			"Mode Order": ElementUtils.getElementOrNull<HTMLSelectElement>("#mode-form-order")?.selectedOptions[0]?.value ?? "[Unknown]",
			"Mode Range": ElementUtils.getElementOrNull<HTMLSelectElement>("#mode-form-range")?.selectedOptions[0]?.value ?? "[Unknown]",
			"Split by Metadata": ElementUtils.getElementOrNull<HTMLInputElement>("#mode-form-split-by-metadata")?.checked ?? "[Unknown]",
			"List": ElementUtils.getElementOrNull<HTMLSelectElement>("#list-form")?.selectedOptions[0]?.value ?? "[Unknown]",
			"Start Datetime": ElementUtils.getElementOrNull<HTMLInputElement>("#datetime-start-form")?.value ?? "[Unknown]",
			"Start UTC Offset": ElementUtils.getElementOrNull<HTMLInputElement>("#utc-offset-start-form")?.value ?? "[Unknown]",
			"End Datetime": ElementUtils.getElementOrNull<HTMLInputElement>("#datetime-end-form")?.value ?? "[Unknown]",
			"End UTC Offset": ElementUtils.getElementOrNull<HTMLInputElement>("#utc-offset-end-form")?.value ?? "[Unknown]",
			"Exclusive Datetimes": ElementUtils.getElementOrNull<HTMLInputElement>("#date-exclusive-bound-form")?.checked ?? "[Unknown]",
		};
		/* TODO: Truncate main error message to ~50 characters, so it doesn't push the request for a GitHub
		   issue off the edge of the screen.*/
		let errorMessage = `
			<div class="stack-vertically">
				<p class="list-name">An unhandled error occurred:<br>
					"${errorData["Message"]}"<br>
					<br>
					Please report this as a ${OutputWindow.#printLinkable(
						{name: "GitHub Issue", url: "https://github.com/Nel-S/chronology-calculator/issues"}
					)}!
				</p>
				<p class="label">
					Please also copy the following information into your report:<br>
					<br>
					<ul>`;
		Object.entries(errorData).forEach(
			([key, value]) => errorMessage += `<li>${key}: ${value}</li>`
		);
		Object.entries(environmentData).forEach(
			([key, value]) => errorMessage += `<li>${key}: ${value}</li>`
		);
		errorMessage += "<li>Current configuration:<ul>";
		Object.entries(currentConfigurationData).forEach(
			([key, value]) => errorMessage += `<li>${key}: ${value}</li>`
		);
		errorMessage += "</ul></li>";
		errorMessage += `
					</ul>
				</p>
			</div>`;
		this.write(errorMessage);
	}

	printEntries(originalList: TimeseriesList, entriesOrMetadataLists: (Entry | null)[][] | Entry[]): void {
		// Blank the window WITHOUT clearing the last updated text.
		this.blank("window");
		for (const entryOrMetadataList of entriesOrMetadataLists) {
			if (entryOrMetadataList instanceof Array) {
				let entryHTML = `<div class="stack-horizontally-wrap spaced">`;
				for (let i = 0; i < entryOrMetadataList.length; ++i) {
					const currentMetadata = entryOrMetadataList[i];

					const label = StringUtils.capitalize(
						!i ? originalList.defaultLabel : originalList.metadata[i-1]
					);
					let nameText: string;
					let subtext: string;
					if (!currentMetadata) {
						nameText = "[None existed]";
						subtext = "";
					} else {
						nameText = OutputWindow.#printLinkable(currentMetadata) + this.#toCitations(currentMetadata.sources);
						subtext = `~ ${originalList.highResolution ? DateUtils.extractDateAndTime(currentMetadata.timestamp, true) + " UTC" : DateUtils.extractDate(currentMetadata.timestamp)}`;
					}
	
					entryHTML += `
						<div class="stack-vertically should-fade-in">
							<p class="label">${label}:</p>
							<p class="list-name">${nameText}</p>
							<p class="subtext">${subtext}</p>
						</div>`
				}
				entryHTML += "</div>";
				this.write(entryHTML, true);
			} else {
				let nameText = OutputWindow.#printLinkable(entryOrMetadataList) + this.#toCitations(entryOrMetadataList.sources);
				let subtext = `~ ${originalList.highResolution ? DateUtils.extractDateAndTime(entryOrMetadataList.timestamp, true) + " UTC" : DateUtils.extractDate(entryOrMetadataList.timestamp)}`;
				const currentEntryMetadata = Object.keys(entryOrMetadataList).filter(
					(key) => originalList.metadata.includes(key)
				);
				for (const metadata of (currentEntryMetadata.length ? currentEntryMetadata : [originalList.defaultLabel])) {
					subtext += `, ${metadata}`;
				}
				this.write(
					`<div class="should-fade-in">
						<p class="list-name">${nameText}</p>
						<p class="subtext">${subtext}</p>
					</div>`, true
				);
			}
		}
	}

	setLastUpdated(dates: Date | null | (Date | null)[]): void {
		const MILLISECONDS_PER_DAY = 86400000;
		const currentDate = new Date();
		let text: string;
		if (dates == null) {
			text = "It is unknown when this list was last updated.";
		} else if (dates instanceof Date) {
			const duration = Math.floor(DateUtils.millisecondsBetween(dates, currentDate)/MILLISECONDS_PER_DAY);
			text = `This list was last updated ${duration} day${duration == 1 ? "" : "s"} ago.`;
		} else {
			const sortedDates = dates.filter(
				(date) => date !== null
			).toSorted();
			if (!sortedDates.length) text = "It is unknown when this list was last updated.";
			else {
				const earliestDuration = Math.floor(DateUtils.millisecondsBetween(sortedDates[0], currentDate)/MILLISECONDS_PER_DAY);
				const latestDuration = Math.floor(DateUtils.millisecondsBetween(sortedDates[sortedDates.length - 1], currentDate)/MILLISECONDS_PER_DAY);
				text = latestDuration == earliestDuration ?
					`Elements of this list were last updated ${latestDuration} day${latestDuration == 1 ? "" : "s"} ago.` :
					`Elements of this list were last updated between ${earliestDuration} and ${latestDuration} days ago.`;
			}
		}
		this.lastUpdatedText.innerText = text;
	}
}