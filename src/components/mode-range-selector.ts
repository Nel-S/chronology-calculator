import {type TimeseriesList} from "../lists.js";
import {ElementUtils} from "../util.js";
import {Selector} from "./selector.js";

const DEFAULT_RANGES: Record<string, (list: TimeseriesList, dates: {lower: Date, upper: Date}, exclusive: boolean) => [number, number][]> = {
	"Before/During Start Date": function(list: TimeseriesList, dates: {lower: Date, upper: Date}, exclusive: boolean = true): [number, number][] {
		const maxIndex = maxIndexBeforeDate(list, dates.lower, exclusive);
		if (maxIndex === null) return [];
		return [[maxIndex, list.entries.length - 1]];
	},
	"After/During Start Date": function(list: TimeseriesList, dates: {lower: Date, upper: Date}, exclusive: boolean = true): [number, number][] {
		const minIndex = minIndexAfterDate(list, dates.lower, exclusive);
		if (minIndex === null) return [];
		return [[0, minIndex]];
	},
	"Before/During End Date": function(list: TimeseriesList, dates: {lower: Date, upper: Date}, exclusive: boolean = true): [number, number][] {
		const maxIndex = maxIndexBeforeDate(list, dates.upper, exclusive);
		if (maxIndex === null) return [];
		return [[maxIndex, list.entries.length - 1]];
	},
	"After/During End Date": function(list: TimeseriesList, dates: {lower: Date, upper: Date}, exclusive: boolean = true): [number, number][] {
		const minIndex = minIndexAfterDate(list, dates.upper, exclusive);
		if (minIndex === null) return [];
		return [[0, minIndex]];
	},
	"Between/During Dates": function(list: TimeseriesList, dates: {lower: Date, upper: Date}, exclusive: boolean = true): [number, number][] {
		const minIndex = minIndexAfterDate(list, dates.lower, exclusive);
		const maxIndex = maxIndexBeforeDate(list, dates.upper, exclusive);
		if (minIndex === null || maxIndex === null) return [];
		return [[maxIndex, minIndex]];
	},
	"Not Between/During Dates": function(list: TimeseriesList, dates: {lower: Date, upper: Date}, exclusive: boolean = true): [number, number][] {
		const beforeMaxIndex = maxIndexBeforeDate(list, dates.lower, exclusive);
		const afterMinIndex = minIndexAfterDate(list, dates.upper, exclusive);
		if (beforeMaxIndex === null || afterMinIndex === null) return [];
		return [[0, afterMinIndex], [beforeMaxIndex, list.entries.length - 1]];
	}
};

function maxIndexBeforeDate(
	list: TimeseriesList | null,
	date: Date | null,
	exclusive: boolean = false
) : number | null {
	if (!list || !list.entries || !date) return null;

	// Find the minimum i such that date >= list.entries[i] if inclusive, or date > list.entries[i] if exclusive.
	// = Either date >= list.entries[0] (inclusive; date > list.entries[0] exclusive), or for i > 1, find i such that list.entries[i - 1] > date >(=?) list.entries[i].
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

// TODO: Doesn't currently work.
function minIndexAfterDate(
	list: TimeseriesList | null,
	date: Date | null,
	exclusive: boolean = false
) : number | null {
	if (!list || !list.entries || !date) return null;

	// Find the maximum i such that date <= list.entries[i].
	// = Either date <= list.entries[length-1], or for i < length-1, find i such that list.entries[i - 1] < date <= list.entries[i].
	let latestIndex = 0, earliestIndex = list.entries.length - 1;
	let found = false;
	// While there's still a range of indices to check:
	while (latestIndex <= earliestIndex) {
		// Get (approximate) middle index
		const middleIndex = Math.floor((latestIndex + earliestIndex)/2);
		// If not (date <= list.entries[i]), we can discard entries [0-i? i-end?]
		if (
			exclusive ? date >= list.entries[middleIndex].timestamp
			: date > list.entries[middleIndex].timestamp
		) {
			earliestIndex = middleIndex - 1;
			continue;
		}
		// If not (list.entries[i - 1] < date), we can discard entries [i-end? 0-i?]
		if (middleIndex > 0 && list.entries[middleIndex - 1].timestamp >= date) {
			latestIndex = middleIndex + 1;
			continue;
		}
		// Otherwise list.entries[i - 1] < date <= list.entries[i] as desired
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
		if (this.rangeSelector.contains("Before/During End Date")) {
			this.rangeSelector.element.value = "Before/During End Date";
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
		if (!currentFunction || exclusive == null) return [];
		return currentFunction(list, dates, exclusive);
	}
}