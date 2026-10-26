import {type TimeseriesList} from "../lists.js";
import {Selector} from "./selector.js";

const DEFAULT_RANGES = new Map([
	[
		"Before/During Start Date", function(list: TimeseriesList, dates: {lower: Date, upper: Date}, inclusive: boolean = true): [number, number][] {
			const maxIndex = IndexMethods.maxIndexBeforeDate(list, dates.lower, inclusive);
			if (maxIndex === null) return [];
			return [[maxIndex, list.entries.length - 1]];
		}
	],
	[
		"After/During Start Date", function(list: TimeseriesList, dates: {lower: Date, upper: Date}, inclusive: boolean = true): [number, number][] {
			const minIndex = IndexMethods.minIndexAfterDate(list, dates.lower, inclusive);
			if (minIndex === null) return [];
			return [[0, minIndex]];
		}
	],
	[
		"Before/During End Date", function(list: TimeseriesList, dates: {lower: Date, upper: Date}, inclusive: boolean = true): [number, number][] {
			const maxIndex = IndexMethods.maxIndexBeforeDate(list, dates.upper, inclusive);
			if (maxIndex === null) return [];
			return [[maxIndex, list.entries.length - 1]];
		}
	],
	[
		"After/During End Date", function(list: TimeseriesList, dates: {lower: Date, upper: Date}, inclusive: boolean = true): [number, number][] {
			const minIndex = IndexMethods.minIndexAfterDate(list, dates.upper, inclusive);
			if (minIndex === null) return [];
			return [[0, minIndex]];
		}
	],
	[
		"Between/During Dates", function(list: TimeseriesList, dates: {lower: Date, upper: Date}, inclusive: boolean = true): [number, number][] {
			const minIndex = IndexMethods.minIndexAfterDate(list, dates.lower, inclusive);
			const maxIndex = IndexMethods.maxIndexBeforeDate(list, dates.upper, inclusive);
			if (minIndex === null || maxIndex === null) return [];
			return [[maxIndex, minIndex]];
		}
	],
	[
		"Not Between/During Dates", function(list: TimeseriesList, dates: {lower: Date, upper: Date}, inclusive: boolean = true): [number, number][] {
			const beforeMaxIndex = IndexMethods.maxIndexBeforeDate(list, dates.lower, inclusive);
			const afterMinIndex = IndexMethods.minIndexAfterDate(list, dates.upper, inclusive);
			if (beforeMaxIndex === null || afterMinIndex === null) return [];
			return [[0, afterMinIndex], [beforeMaxIndex, list.entries.length - 1]];
		}
	],
]);

const DEFAULT_INCLUSIVITY_VALUES = new Map([
	[
		"Inclusive",
		true
	],
	[
		"Exclusive",
		false
	]
]);

class IndexMethods {
	static maxIndexBeforeDate(
		list: TimeseriesList | null,
		date: Date | null,
		inclusive: boolean = true
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
				inclusive ? date < list.entries[middleIndex].timestamp
				: date <= list.entries[middleIndex].timestamp
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

	static minIndexAfterDate(
		list: TimeseriesList | null,
		date: Date | null,
		inclusive: boolean = true
	) : number | null {
		// TODO: Verify logic
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
				inclusive ? date > list.entries[middleIndex].timestamp
				: date >= list.entries[middleIndex].timestamp
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
}

export class ModeRangeSelector {
	rangeSelector: Selector<
		(list: TimeseriesList, dates: {lower: Date, upper: Date}, inclusive: boolean) => [number, number][],
		HTMLSelectElement
	>;
	inclusivitySelector: Selector<
		boolean,
		HTMLSelectElement
	>;

	constructor(rangesElementID: string, inclusivityElementID: string) {
		this.rangeSelector = new Selector<
			(list: TimeseriesList, dates: {lower: Date, upper: Date}, inclusive: boolean) => [number, number][],
			HTMLSelectElement
		>(rangesElementID).addAll(DEFAULT_RANGES);
		this.inclusivitySelector = new Selector<
			boolean, HTMLSelectElement
		>(inclusivityElementID).addAll(DEFAULT_INCLUSIVITY_VALUES);
	}

	evaluate(list: TimeseriesList, dates: {lower: Date, upper: Date}): [number, number][] {
		const currentFunction = this.rangeSelector.get().value;
		const inclusive = this.inclusivitySelector.get().value;
		if (!currentFunction || inclusive == null) return [];
		return currentFunction(list, dates, inclusive);
	}
}