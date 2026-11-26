import {type TimeseriesList} from "../lists.js";
import {ElementUtils} from "../util.js";
import {Selector} from "./selector.js";

const DEFAULT_RANGES: Record<string, (list: TimeseriesList, dates: {lower: Date, upper: Date}, exclusive: boolean) => [number, number][]> = {
	"Before Start Date": function(list: TimeseriesList, dates: {lower: Date, upper: Date}, exclusive: boolean = true): [number, number][] {
		const maxIndex = maxEntryBeforeDateIndex(list, dates.lower, exclusive);
		if (maxIndex === null) return [];
		return [[maxIndex, list.entries.length - 1]];
	},
	"After Start Date": function(list: TimeseriesList, dates: {lower: Date, upper: Date}, exclusive: boolean = true): [number, number][] {
		const minIndex = minEntryAfterDateIndex(list, dates.lower, exclusive);
		if (minIndex === null) return [];
		return [[0, minIndex]];
	},
	"Before End Date": function(list: TimeseriesList, dates: {lower: Date, upper: Date}, exclusive: boolean = true): [number, number][] {
		const maxIndex = maxEntryBeforeDateIndex(list, dates.upper, exclusive);
		if (maxIndex === null) return [];
		return [[maxIndex, list.entries.length - 1]];
	},
	"After End Date": function(list: TimeseriesList, dates: {lower: Date, upper: Date}, exclusive: boolean = true): [number, number][] {
		const minIndex = minEntryAfterDateIndex(list, dates.upper, exclusive);
		if (minIndex === null) return [];
		return [[0, minIndex]];
	},
	"Between Dates": function(list: TimeseriesList, dates: {lower: Date, upper: Date}, exclusive: boolean = true): [number, number][] {
		const minIndex = minEntryAfterDateIndex(list, dates.lower, exclusive);
		const maxIndex = maxEntryBeforeDateIndex(list, dates.upper, exclusive);
		if (minIndex === null || maxIndex === null || minIndex < maxIndex) return [];
		return [[maxIndex, minIndex]];
	},
	"Not Between Dates": function(list: TimeseriesList, dates: {lower: Date, upper: Date}, exclusive: boolean = true): [number, number][] {
		const beforeMaxIndex = maxEntryBeforeDateIndex(list, dates.lower, exclusive);
		const afterMinIndex = minEntryAfterDateIndex(list, dates.upper, exclusive);
		if (beforeMaxIndex === null || afterMinIndex === null || beforeMaxIndex < afterMinIndex) return [];
		return [[0, afterMinIndex], [beforeMaxIndex, list.entries.length - 1]];
	}
};

function maxEntryBeforeDateIndex(
	list: TimeseriesList,
	date: Date,
	exclusive: boolean = false
) : number | null {
	/* Find the maximum entry ( = minimum i, since the list is in descending order) such that
	   date >= list.entries[i] if inclusive, or date > list.entries[i] if exclusive.
	   = Either date >(=?) list.entries[0], or for i > 1, find i such that
	   list.entries[i - 1] > date >(=?) list.entries[i].*/
	let latestIndex = 0, earliestIndex = list.entries.length - 1;
	let found = false;
	// While there's still a range of indices to check:
	while (latestIndex <= earliestIndex) {
		// Get (approximate) middle index
		const middleIndex = Math.floor((latestIndex + earliestIndex)/2);
		// If not (date >= list.entries[i]), we can discard entries 0-i
		if (
			exclusive ? date <= list.entries[middleIndex].timestamp
			: date < list.entries[middleIndex].timestamp
		) {
			latestIndex = middleIndex + 1;
			continue;
		}
		// If not (list.entries[i - 1] > date), we can discard entries i-end
		if (middleIndex > 0 && list.entries[middleIndex - 1].timestamp <= date) {
			earliestIndex = middleIndex - 1;
			continue;
		}
		// Otherwise list.entries[i - 1] > date >= list.entries[i] as desired
		latestIndex = middleIndex;
		found = true;
		break;
	}
	if (!found) return null;

	return latestIndex;
}

function minEntryAfterDateIndex(
	list: TimeseriesList,
	date: Date,
	exclusive: boolean = false
) : number | null {
	/* Find the minimum entry ( = maximum i, since the list is in descending order) such that
	   date <= list.entries[i] if inclusive, or date < list.entries[i] if exclusive.
	   = Either date <(=?) list.entries[length-1], or for i < length-1, find i such that
	   list.entries[i + 1] < date <(=?) list.entries[i].*/
	let latestIndex = 0, earliestIndex = list.entries.length - 1;
	let found = false;
	// While there's still a range of indices to check:
	while (latestIndex <= earliestIndex) {
		// Get (approximate) middle index
		const middleIndex = Math.ceil((latestIndex + earliestIndex)/2);
		// If not (date <= list.entries[i]), we can discard entries i-end
		if (
			exclusive ? date >= list.entries[middleIndex].timestamp
			: date > list.entries[middleIndex].timestamp
		) {
			earliestIndex = middleIndex - 1;
			continue;
		}
		// If not (list.entries[i + 1] < date), we can discard entries 0-i
		if (middleIndex < list.entries.length - 1 && list.entries[middleIndex + 1].timestamp >= date) {
			latestIndex = middleIndex + 1;
			continue;
		}
		// Otherwise list.entries[i + 1] < date <= list.entries[i] as desired
		earliestIndex = middleIndex;
		found = true;
		break;
	}
	if (!found) return null;

	return earliestIndex;
}

export class ModeRangeSelector {
	rangeSelector: Selector<
		(list: TimeseriesList, dates: {lower: Date, upper: Date}, exclusive: boolean) => [number, number][],
		HTMLSelectElement
	>;
	inclusivitySelector: HTMLInputElement;

	constructor(rangesElementID: string, inclusivityElementID: string) {
		this.rangeSelector = new Selector<
			(list: TimeseriesList, dates: {lower: Date, upper: Date}, exclusive: boolean) => [number, number][],
			HTMLSelectElement
		>(rangesElementID, DEFAULT_RANGES);
		if (this.rangeSelector.contains("Before End Date")) {
			this.rangeSelector.element.value = "Before End Date";
		}
		this.inclusivitySelector = ElementUtils.getElementOrThrow<HTMLInputElement>(inclusivityElementID);
		this.inclusivitySelector.checked = false;

		// Custom event notifier when new range is selected
		this.rangeSelector.element.addEventListener("input",
			() => this.rangeSelector.element.dispatchEvent(new CustomEvent("mode-range-change", {
				bubbles: true,
				detail: {
					selection: this.rangeSelector.selection.label
				}
			}))
		);

		// Update buttons' responsivities depending on list selection
		window.addEventListener("list-change", (e) => {
			if (!(e instanceof CustomEvent)) throw new Error("Custom event listener did not receive a CustomEvent.");
			const listSelection = e.detail?.selection ?? "";
			if (listSelection == "From URL" || listSelection == "From File Upload") {
				this.inclusivitySelector.disabled = true;
				this.rangeSelector.hide();
			} else {
				this.inclusivitySelector.disabled = false;
				this.rangeSelector.show();
				this.rangeSelector.element.dispatchEvent(new Event("input"));
			}
		});
	}

	evaluate(list: TimeseriesList, dates: {lower: Date, upper: Date}): [number, number][] {
		const currentFunction = this.rangeSelector.selection.value;
		const exclusive = this.inclusivitySelector.checked;
		if (currentFunction == null || exclusive == null) return [];
		return currentFunction(list, dates, exclusive);
	}
}