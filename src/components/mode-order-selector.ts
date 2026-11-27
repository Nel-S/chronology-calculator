import {type Entry, type TimeseriesList} from "../lists.js";
import {ElementUtils} from "../util.js";
import {Selector} from "./selector.js";

const DEFAULT_ORDERS: Record<string, (list: TimeseriesList, indices: [number, number][], metadata: boolean) => Record<string, Entry[]> | Entry[]> = {
	"Find First Entry": function(list: TimeseriesList, indices: [number, number][], metadata: boolean = true): Record<string, Entry[]> | Entry[] {
		return (metadata ? getMetadata : getEntries)(list, indices,
			(entries) => !entries.length ?
				[] :
				[entries[entries.length - 1]]
		);
	},
	"Find Last Entry": function(list: TimeseriesList, indices: [number, number][], metadata: boolean = true): Record<string, Entry[]> | Entry[] {
		return (metadata ? getMetadata : getEntries)(list, indices,
			(entries) => !entries.length ?
				[] :
				[entries[0]]
		);
	},
	"Find Median Entries": function(list: TimeseriesList, indices: [number, number][], metadata: boolean = true): Record<string, Entry[]> | Entry[] {
		return (metadata ? getMetadata : getEntries)(list, indices,
			(entries) => {
				if (!entries.length) return [];
				const oddNumberOfEntries = entries.length & 1;
				const median = Math.floor(entries.length/2.);
				return oddNumberOfEntries ?
					[entries[median]] :
					[entries[median], list.entries[median+1]];
			}
		);
	},
	"Find Random Entry": function(list: TimeseriesList, indices: [number, number][], metadata: boolean = true): Record<string, Entry[]> | Entry[] {
		return (metadata ? getMetadata : getEntries)(list, indices,
			(entries) => !entries.length ?
				[] :
				[entries[Math.floor(Math.random()*entries.length)]]
		);
	},
	"Find All Entries": function(list: TimeseriesList, indices: [number, number][], metadata: boolean = true): Record<string, Entry[]> | Entry[] {
		return (metadata ? getMetadata : getEntries)(list, indices,
			(entries) => entries
		);
	}
};

function getMetadata(list: TimeseriesList, indices: [number, number][], predicate: (x: Entry[]) => Entry[]): Record<string, Entry[]> {
	// For backwards-compatibility reasons, we place the defaultLabel entries first in the order of keys.
	const defaultLabelEntry: Record<string, Entry[]> = {};
	defaultLabelEntry[list.defaultLabel] = predicate(indices.flatMap(
		(indexPair) => list.entries.slice(indexPair[0], indexPair[1]+1).filter(
			(entry) => !Object.keys(entry).filter(
				(key) => list.metadata.includes(key)
			).length
		)
	));
	/* Then combine that with the entries for each of the metadata.
	   Admittedly from Google's search result AI Overview.*/
	return {
		...defaultLabelEntry,
		...Object.fromEntries(
			list.metadata.map(
				(datum) => [datum, predicate(indices.flatMap(
					(indexPair) => list.entries.slice(indexPair[0], indexPair[1]+1).filter(
						(entry) => datum in entry
					)
				))]
			)
		)
	}
}

function getEntries(list: TimeseriesList, indices: [number, number][], predicate: (x: Entry[]) => Entry[]): Entry[] {
	return predicate(indices.flatMap(
		(indexPair) => list.entries.slice(indexPair[0], indexPair[1]+1)
	));
}

export class ModeOrderSelector {
	orderSelector: Selector<
		(list: TimeseriesList, indices: [number, number][], metadata: boolean) => Record<string, Entry[]> | Entry[],
		HTMLSelectElement
	>;
	typeSelector: HTMLInputElement

	constructor(ordersElementID: string, typeElementID: string) {
		this.orderSelector = new Selector<
			(list: TimeseriesList, indices: [number, number][], metadata: boolean) => Record<string, Entry[]> | Entry[],
			HTMLSelectElement
		>(ordersElementID, DEFAULT_ORDERS);
		if (this.orderSelector.contains("Find Last Entry")) {
			this.orderSelector.element.value = "Find Last Entry";
		}
		this.typeSelector = ElementUtils.getElementOrThrow<HTMLInputElement>(typeElementID);
		this.typeSelector.checked = true;

		// Update buttons' responsivities depending on list selection
		window.addEventListener("list-change", (e) => {
			if (!(e instanceof CustomEvent)) throw new Error("Custom event listener did not receive a CustomEvent.");
			const listSelection = e.detail?.selection ?? "";
			if (listSelection == "From URL" || listSelection == "From File Upload") {
				this.typeSelector.disabled = true;
				this.orderSelector.hide();
			} else {
				this.typeSelector.disabled = false;
				this.orderSelector.show();
			}
		});
	}

	evaluate(list: TimeseriesList, indices: [number, number][]): Record<string, Entry[]> | Entry[] {
		const currentFunction = this.orderSelector.selection.value;
		const type = this.typeSelector.checked;
		if (currentFunction == null || type == null) return [];
		return currentFunction(list, indices, type);
	}
}