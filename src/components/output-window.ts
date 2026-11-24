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
		const errorData = error instanceof ErrorEvent ? {
			message: error.message,
			type: error.type,
			file: error.filename,
			lineNumber: error.lineno,
			columnNumber: error.colno,
			stack: "stack" in error ?
				error.stack :
				"stack" in error.error ?
					error.error.stack :
					"[Unsupported]"
		} : {
			message: error.reason,
			type: error.type,
			file: "[Unknown]",
			lineNumber: "[Unknown]",
			columnNumber: "[Unknown]",
			stack: error.reason.stack ?? "[Unsupported]"
		};
		// Data related to the surrounding page environment.
		const environmentData = {
			// TODO: Implement.
			// buildVersion: import.meta.env.BUILD_VERSION ?? "[Unknown]",
			buildType: import.meta.env.MODE ?? "[Unknown]",
			/* TODO: These should be replaced with references to the corresponding components, especially
			   because the mapped list external reference, etc. should also be displayed as well. */
			currentModeOrder: ElementUtils.getElementOrNull<HTMLSelectElement>("#mode-form-order")?.selectedOptions[0]?.value ?? "[Unknown]",
			currentModeRange: ElementUtils.getElementOrNull<HTMLSelectElement>("#mode-form-range")?.selectedOptions[0]?.value ?? "[Unknown]",
			currentSplitByMetadata: ElementUtils.getElementOrNull<HTMLInputElement>("#mode-form-split-by-metadata")?.checked ?? "[Unknown]",
			currentList: ElementUtils.getElementOrNull<HTMLSelectElement>("#list-form")?.selectedOptions[0]?.value ?? "[Unknown]",
			currentStartDatetime: ElementUtils.getElementOrNull<HTMLInputElement>("#datetime-start-form")?.value ?? "[Unknown]",
			currentStartUTCOffset: ElementUtils.getElementOrNull<HTMLInputElement>("#utc-offset-start-form")?.value ?? "[Unknown]",
			currentEndDatetime: ElementUtils.getElementOrNull<HTMLInputElement>("#datetime-end-form")?.value ?? "[Unknown]",
			currentEndUTCOffset: ElementUtils.getElementOrNull<HTMLInputElement>("#utc-offset-end-form")?.value ?? "[Unknown]",
			currentExclusiveDatetimes: ElementUtils.getElementOrNull<HTMLInputElement>("#date-exclusive-bound-form")?.checked ?? "[Unknown]",
		};
		/* TODO: Truncate main error message to ~50 characters, so it doesn't push the request for a GitHub
		   issue off the edge of the screen.*/
		this.write(`
			<div class="stack-vertically">
				<p class="list-name">An unhandled error occurred:<br>
					"${errorData.message}"<br>
					<br>
					Please report this as a ${OutputWindow.#printLinkable(
						{name: "GitHub Issue", url: "https://github.com/Nel-S/chronology-calculator/issues"}
					)}!
				</p>
				<p class="label">
					Please also copy the following information into your report:<br>
					<br>
					<ul>
						<li>Message: "${errorData.message}"</li>
						<li>Error type: ${errorData.type}</li>
						<li>Build type: ${environmentData.buildType}</li>
						<li>File: ${errorData.file}</li>
						<li>Line: ${errorData.lineNumber}</li>
						<li>Column: ${errorData.columnNumber}</li>
						<li>Stack trace: ${errorData.stack}</li>
						<li>
							Current configuration:<ul>
								<li>Mode order: "${environmentData.currentModeOrder}"</li>
								<li>Mode range: "${environmentData.currentModeRange}"</li>
								<li>Mode split by metadata: ${environmentData.currentSplitByMetadata}</li>
								<li>List: "${environmentData.currentList}"</li>
								<li>Start datetime: "${environmentData.currentStartDatetime}"</li>
								<li>Start UTC offset: "${environmentData.currentStartUTCOffset}"</li>
								<li>End datetime: "${environmentData.currentEndDatetime}"</li>
								<li>End UTC offset: "${environmentData.currentEndUTCOffset}"</li>
								<li>Exclusive datetimes: "${environmentData.currentExclusiveDatetimes}"</li>
							</ul>
						</li>
					</ul>
				</p>
			</div>`
		);
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