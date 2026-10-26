import {type Entry, type TimeseriesList} from "../lists.js";
import {Selector} from "./selector.js";

const DEFAULT_ORDERS = new Map([
	[
		"First", function(list: TimeseriesList, indices: [number, number][], metadata: boolean = true): (Entry | null)[][] {
			return indices.map(
				(indexPair) => metadata ?
					EntryMethods.firstMetadata(list, indexPair) :
					[list.entries[indexPair[0]]]
			);
		}
	],
	[
		"Last", function(list: TimeseriesList, indices: [number, number][], metadata: boolean = true): (Entry | null)[][] {
			return indices.map(
				(indexPair) => metadata ?
					EntryMethods.lastMetadata(list, indexPair) :
					[list.entries[indexPair[1]]]
			);
		}
	],
	[
		"Median", function(list: TimeseriesList, indices: [number, number][], metadata: boolean = true): (Entry | null)[][] {
			return indices.map(
				(indexPair) => {
					if (metadata) return EntryMethods.medianMetadata(list, indexPair);
					const oddNumberOfEntries = (indexPair[0] & 1) == (indexPair[1] & 1);
					const median = Math.floor((indexPair[0] + indexPair[1])/2.);
					return oddNumberOfEntries ?
						[list.entries[median]] :
						[list.entries[median], list.entries[median+1]];
				}
			);
		}
	],
	[
		"Random", function(list: TimeseriesList, indices: [number, number][], metadata: boolean = true): (Entry | null)[][] {
			return indices.map(
				(indexPair) => metadata ?
					EntryMethods.randomMetadata(list, indexPair) :
					[list.entries[
						indexPair[0] + Math.floor(Math.random()*(indexPair[1] - indexPair[0] + 1))
					]]
			);
		}
	],
	[
		"All", function(list: TimeseriesList, indices: [number, number][], metadata: boolean = true): (Entry | null)[][] {
			metadata; // TODO: Possibly make different?
			return indices.map(
				(indexPair) => list.entries.slice(indexPair[0], indexPair[1]+1)
			);
		}
	]
]);

const DEFAULT_TYPES = new Map([
	[
		"Of Each Metadata",
		true
	],
	[
		"Unaltered Entry",
		false
	]
]);

class EntryMethods {
	static firstMetadata(list: TimeseriesList | null, indices: [number, number]) : (Entry | null)[] {
		if (!list || !list.metadata || !indices) return [];

		// The ultimate array of first entries to be outputted.
		const entries: (Entry | null)[] = new Array(list.metadata.length + 1).fill(null);
		// A "metadata -> entries index" mapping, for convienence.
		const metadataIndices = Object.fromEntries(
			list.metadata.map((metadata, index) => [metadata, index + 1])
		);
		
		// For each entry from the latest-index entry onwards, unless all first entries are found:
		for (let i = indices[0]; i <= indices[1] && entries.some((entry) => entry === null); ++i) {
			// Get metadata keys in current entry
			const currentEntryMetadata = Object.keys(list.entries[i]).filter(
				(key) => list.metadata.includes(key)
			);
			// If none exist, the entry is a candidate for the default output box, unless an earlier
			// one's already been found for it
			if (!currentEntryMetadata.length) {
				if (entries[0] === null) entries[0] = list.entries[i];
			} else {
				// Otherwise, drop metadata that already has a first entry, and assign all remaining as having the current entry as their 
				currentEntryMetadata.filter((datum) => entries[metadataIndices[datum]] == null).forEach((datum) => entries[metadataIndices[datum]] = list.entries[i]);
			}
		}
		return entries;
	}

	static lastMetadata(list: TimeseriesList | null, indices: [number, number]) : (Entry | null)[] {
		if (!list || !list.metadata || !indices) return [];

		// The ultimate array of first entries to be outputted.
		const entries: (Entry | null)[] = new Array(list.metadata.length + 1).fill(null);
		// A "metadata -> entries index" mapping, for convienence.
		const metadataIndices = Object.fromEntries(
			list.metadata.map((metadata, index) => [metadata, index + 1])
		);
		
		// For each entry from the latest-index entry onwards, unless all first entries are found:
		for (let i = indices[1]; i >= indices[0] && entries.some((entry) => entry === null); --i) {
			// Get metadata keys in current entry
			const currentEntryMetadata = Object.keys(list.entries[i]).filter(
				(key) => list.metadata.includes(key)
			);
			// If none exist, the entry is a candidate for the default output box, unless an earlier
			// one's already been found for it
			if (!currentEntryMetadata.length) {
				if (entries[0] === null) entries[0] = list.entries[i];
			} else {
				// Otherwise, drop metadata that already has a first entry, and assign all remaining as having the current entry as their 
				currentEntryMetadata.filter((datum) => entries[metadataIndices[datum]] == null).forEach((datum) => entries[metadataIndices[datum]] = list.entries[i]);
			}
		}
		return entries;
	}

	static medianMetadata(list: TimeseriesList | null, indices: [number, number]) : (Entry | null)[] {
		if (!list || !list.metadata || !indices) return [];

		// The ultimate array of first entries to be outputted.
		const entries: (Entry | null)[] = new Array(list.metadata.length + 1).fill(null);
		// A "metadata -> entries index" mapping, for convienence.
		const metadataIndices = Object.fromEntries(
			list.metadata.map((metadata, index) => [metadata, index + 1])
		);
		
		const medianIndex = Math.floor((indices[0] + indices[1])/2.);
		// For each entry from the latest-index entry onwards, unless all first entries are found:
		for (
			let i = medianIndex, step = 0;
			i >= indices[0] && i <= indices[1] && entries.some((entry) => entry === null);
			++step, i += (step & 1 ? step : -step)
		) {
			// Get metadata keys in current entry
			const currentEntryMetadata = Object.keys(list.entries[i]).filter(
				(key) => list.metadata.includes(key)
			);
			// If none exist, the entry is a candidate for the default output box, unless an earlier
			// one's already been found for it
			if (!currentEntryMetadata.length) {
				if (entries[0] === null) entries[0] = list.entries[i];
			} else {
				// Otherwise, drop metadata that already has a first entry, and assign all remaining as having the current entry as their 
				currentEntryMetadata.filter((datum) => entries[metadataIndices[datum]] == null).forEach((datum) => entries[metadataIndices[datum]] = list.entries[i]);
			}
		}
		return entries;
	}

	static randomMetadata(list: TimeseriesList | null, indices: [number, number]) : (Entry | null)[] {
		if (!list || !list.metadata || !indices) return [];

		// The ultimate array of first entries to be outputted.
		const entries: (Entry | null)[] = new Array(list.metadata.length + 1).fill(null);
		// A "metadata -> entries index" mapping, for convienence.
		const metadataIndices = Object.fromEntries(
			list.metadata.map((metadata, index) => [metadata, index + 1])
		);

		const noMetadataEntries = list.entries.filter((entry) => !Object.keys(entry).filter(
			(key) => list.metadata.includes(key)
		).length);
		entries[0] = !noMetadataEntries ? null : noMetadataEntries[Math.floor(Math.random()*noMetadataEntries.length)];

		for (const metadata in list.metadata) {
			const metadataEntries = list.entries.filter((entry) => Object.keys(entry).includes(metadata));
			entries[metadataIndices[metadata]] = !metadataEntries ? null : metadataEntries[Math.floor(Math.random()*metadataEntries.length)];
		}
		return entries;
	}
}

export class ModeOrderSelector {
	orderSelector: Selector<
		(list: TimeseriesList, indices: [number, number][], metadata: boolean) => (Entry | null)[][],
		HTMLSelectElement
	>;
	typeSelector: Selector<
		boolean,
		HTMLSelectElement
	>
	constructor(ordersElementID: string, typeElementID: string) {
		this.orderSelector = new Selector<
			(list: TimeseriesList, indices: [number, number][], metadata: boolean) => (Entry | null)[][],
			HTMLSelectElement
		>(ordersElementID).addAll(DEFAULT_ORDERS);
		this.typeSelector = new Selector<
			boolean, HTMLSelectElement
		>(typeElementID).addAll(DEFAULT_TYPES);
	}

	evaluate(list: TimeseriesList, indices: [number, number][]): (Entry | null)[][] {
		const currentFunction = this.orderSelector.get().value;
		const type = this.typeSelector.get().value;
		if (!currentFunction || type == null) return [];
		return currentFunction(list, indices, type);
	}
}