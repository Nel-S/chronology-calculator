import {type Entry, type Linkable, type TimeseriesList} from "../lists";
import {DateUtils, ElementUtils, StringUtils} from "../util";

export class OutputWindow {
	window: HTMLDivElement;
	lastUpdatedText: HTMLParagraphElement;

	constructor(windowID: string, lastUpdatedID: string) {
		this.window = ElementUtils.getElementOrThrow<HTMLDivElement>(windowID);
		this.lastUpdatedText = ElementUtils.getElementOrThrow<HTMLParagraphElement>(lastUpdatedID);
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
		}
	}

	static #printLinkable<T extends Linkable>(linkable: T): string {
		if (!linkable.url) return linkable.name;
		return `<a href="${linkable.url}" title="${linkable.url}">${linkable.name ? linkable.name : linkable.url}</a>`;
	}

	static #toCitations(sources: string[]): string {
		let citations = "";
		for (let j = 0; j < sources.length; ++j) {
			citations += `<sup>${OutputWindow.#printLinkable({
				name: `[${j + 1}]`,
				url: sources[j]
			})}</sup>`;
		}
		return citations;
	}

	printEntries(originalList: TimeseriesList, entriesOrMetadata: (Entry | null)[][] | (Entry | null)[]): void {
		this.blank("window");
		for (const entryOrList of entriesOrMetadata) {
			// console.log("Current entry list:");
			// console.log(entryOrList, entryOrList.length);
			if (!entryOrList) continue;
			if (entryOrList instanceof Array) {
				let entryHTML = `<div class="stack-horizontally-wrap spaced">`;;
				for (let i = 0; i < entryOrList.length; ++i) {
					const currentEntry = entryOrList[i];
					// console.log("Current entry:");
					// console.log(currentEntry);
					let nameText: string;
					let timeText: string;
	
					if (!currentEntry) {
						nameText = "[None existed]";
						timeText = "";
					} else {
						nameText = OutputWindow.#printLinkable(currentEntry) + OutputWindow.#toCitations(currentEntry.sources);
						timeText = `~ ${originalList.highResolution ? DateUtils.extractDateAndTime(currentEntry.timestamp, true) + " UTC" : DateUtils.extractDate(currentEntry.timestamp)}`;
					}
	
					entryHTML += `
			<div class="stack-vertically should-fade-in">
				<p class="label">${StringUtils.capitalize(!i ? originalList.defaultLabel : originalList.metadata[i-1])}:</p>
				<p class="list-name">${nameText}</p>
				<p class="subtext">${timeText}</p>
			</div>`
				}
				entryHTML += `</div>`;
				this.write(entryHTML, true);
			} else {
				let nameText = OutputWindow.#printLinkable(entryOrList) + OutputWindow.#toCitations(entryOrList.sources);
				let subtext = `~ ${originalList.highResolution ? DateUtils.extractDateAndTime(entryOrList.timestamp, true) + " UTC" : DateUtils.extractDate(entryOrList.timestamp)}`;
				const currentEntryMetadata = Object.keys(entryOrList).filter(
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
				text = `Elements of this list were last updated between ${latestDuration} and ${earliestDuration} day${earliestDuration == 1 ? "" : "s"} ago.`
			}
		}
		this.lastUpdatedText.innerText = text;
	}
}