import {externalSchema, timeseriesListSchema, type ExternalList, type TimeseriesList} from "../lists.js";
import {ElementUtils, NetworkUtils} from "../util.js";
import {Selector} from "./selector.js";

const DEFAULT_LIST_REFERENCES = new Map([
	[
		"Minimal Example",
		[
			externalSchema.parse({
				source: "https://raw.githubusercontent.com/Nel-S/chronology-calculator/refs/heads/development/preset-lists/Schema%20Examples/Minimal%20Example.json"
			})
		]
	],
	[
		"Comprehensive Example",
		[
			externalSchema.parse({
				source: "https://raw.githubusercontent.com/Nel-S/chronology-calculator/refs/heads/development/preset-lists/Schema%20Examples/Comprehensive%20Example.json"
			})
		]
	],
	[
		"Java Edition",
		[
			externalSchema.parse({
				source: "https://raw.githubusercontent.com/Nel-S/chronology-calculator/refs/heads/development/preset-lists/Minecraft%20Releases/Java%20Edition.json"
			}),
			externalSchema.parse({
				source: "https://raw.githubusercontent.com/misode/mcmeta/refs/heads/summary/versions/data.json",
				mapper: {
					// These keys should be erased
					"build_time": "",
					"data_pack_version": "",
					"data_pack_version_minor": "",
					"data_version": "",
					"id": "",
					"protocol_version": "",
					"release_target": "",
					"resource_pack_version": "",
					"resource_pack_version_minor": "",
					"sha1": "",
					"stable": "",
					// Version names that were reuploads, and so should be renamed
					// to reduce confusion
					"name=1.14.2 Pre-Release 4": "1.14.2 Pre-Release 4 (270720)",
					"name=1.16": "1.16 (231620)",
					"name=1.16.5 Release Candidate 1": "1.16.5 Release Candidate 1 (1558)",
					// This key should be renamed
					"release_time": "timestamp",
					// Values of "type": "release" should have that key erased
					"type=release": "",
					// Values of "type": "snapshot" should be renamed to "type": "public snapshot"
					"type=snapshot": "public snapshot",
					// This key should have its values set as keys (to act as metadata), with the
					// original key being erased
					"type": "_"
				}
			}),
		]
	],
	[
		"Nintendo Switch Edition",
		[
			externalSchema.parse({
				source: "https://raw.githubusercontent.com/Nel-S/chronology-calculator/refs/heads/development/preset-lists/Minecraft%20Releases/Nintendo%20Switch%20Edition.json"
			})
		]
	],
	[
		"PlayStation 3 Edition",
		[
			externalSchema.parse({
				source: "https://raw.githubusercontent.com/Nel-S/chronology-calculator/refs/heads/development/preset-lists/Minecraft%20Releases/PlayStation%203%20Edition.json"
			})
		]
	],
	[
		"PlayStation 4 Edition",
		[
			externalSchema.parse({
				source: "https://raw.githubusercontent.com/Nel-S/chronology-calculator/refs/heads/development/preset-lists/Minecraft%20Releases/PlayStation%204%20Edition.json"
			})
		]
	],
	[
		"PlayStation Vita Edition",
		[
			externalSchema.parse({
				source: "https://raw.githubusercontent.com/Nel-S/chronology-calculator/refs/heads/development/preset-lists/Minecraft%20Releases/PlayStation%20Vita%20Edition.json"
			})
		]
	],
	[
		"Wii U Edition",
		[
			externalSchema.parse({
				source: "https://raw.githubusercontent.com/Nel-S/chronology-calculator/refs/heads/development/preset-lists/Minecraft%20Releases/Wii%20U%20Edition.json"
			})
		]
	],
	[
		"Xbox 360 Edition",
		[
			externalSchema.parse({
				source: "https://raw.githubusercontent.com/Nel-S/chronology-calculator/refs/heads/development/preset-lists/Minecraft%20Releases/Xbox%20360%20Edition.json"
			})
		]
	],
	[
		"Xbox One Edition",
		[
			externalSchema.parse({
				source: "https://raw.githubusercontent.com/Nel-S/chronology-calculator/refs/heads/development/preset-lists/Minecraft%20Releases/Xbox%20One%20Edition.json"
			})
		]
	],
]);

export class ListSelector {
	listSelector: Selector<ExternalList[], HTMLOptionElement>;
	listCache: Map<string, TimeseriesList>;
	urlForm: HTMLInputElement;
	fileForm: HTMLInputElement;
	uploadedURLsCount: number;
	uploadedFilesCount: number;

	constructor(listElementID: string, urlElementID: string, fileElementID: string) {
		this.listSelector = new Selector<ExternalList[], HTMLOptionElement>(listElementID, DEFAULT_LIST_REFERENCES);
		// TODO: Re-add optgroups
		this.listSelector.element.appendChild(new Option("From URL"));
		this.listSelector.element.appendChild(new Option("From File Upload"));

		this.listCache = new Map();
		this.urlForm = ElementUtils.getElementOrThrow<HTMLInputElement>(urlElementID);
		this.fileForm = ElementUtils.getElementOrThrow<HTMLInputElement>(fileElementID);
		this.listSelector.element.addEventListener("input", this.#updateInputVisibility.bind(this));
		// These MUST be registered before any event listeners that trigger the list calculations.
		this.urlForm.addEventListener("change", this.#registerList.bind(this));
		this.fileForm.addEventListener("change", this.#registerList.bind(this));

		this.uploadedURLsCount = 0;
		this.uploadedFilesCount = 0;
	}

	#updateInputVisibility(): void {
		switch (this.listSelector.selection.label) {
			case "From URL":
				this.urlForm.classList.remove("hidden");
				this.fileForm.classList.add("hidden");
				return;
			case "From File Upload":
				this.urlForm.classList.add("hidden");
				this.fileForm.classList.remove("hidden");
				return;
			default:
				this.urlForm.classList.add("hidden");
				this.urlForm.value = "";
				this.fileForm.classList.add("hidden");
				return;
		}
	}

	#registerList(): boolean {
		const isFileUpload = !this.fileForm.classList.contains("hidden");

		// Get lookup key for upload
		let lookupKey: string;
		if (!isFileUpload) lookupKey = NetworkUtils.encodeURIIfNotAlready(this.urlForm.value);
		else {
			const fileList = this.fileForm.files;
			if (!fileList || !fileList.length) return false;
			lookupKey = URL.createObjectURL(fileList[0]);
			// TODO: Investigate if readAsDataURL (-> Base64) would allow checking
			// if uploaded files match existing ones. If so, we should switch to that.
			// (new FileReader()).readAsDataURL(this.fileForm.files[0]);
		}
		
		// For uploaded URLs, we can check if the upload duplicates an existing entry.
		// If so, we can simply switch the selected list to that one and skip the upload.
		if (!isFileUpload) {
			for (const [key, value] of this.listSelector.mapper) {
				if (value.length != 1 || value[0].source != lookupKey) continue;
				this.listSelector.element.value = key;
				this.listSelector.element.dispatchEvent(new Event("input"));
				return true;
			}
		}

		// Roll into an ExternalList; if unable, abort.
		// TODO: Add mapping support.
		const referenceJSON = {
			source: lookupKey
		};
		let reference: ExternalList;
		try {
			reference = externalSchema.parse(referenceJSON);
		} catch {
			return false;
		}

		// Add to the list of potential lists, and set it as currently-selected one.
		const newLabel = isFileUpload ?
			`Custom File #${++this.uploadedFilesCount}` :
			`Custom URL #${++this.uploadedURLsCount}`;
		this.listSelector.add(newLabel, [reference]);
		this.listSelector.element.value = newLabel;
		this.listSelector.element.dispatchEvent(new Event("input"));
		return true;
	}

	// TODO: This currently features an **extreme** amount of repetition, considering
	// this currently must traverse the entire tree anew for each different key in the
	// mapper. We should refactor this so we only perform the traversal once.
	#renameKeysRecursive(obj: any, keyPath: string[], replacement: string) {
		// If obj is not an object, or the keyPath has been exhausted, abort
		if (obj == null || obj == undefined || !keyPath.length) return;
		const currentKeyPart = keyPath[0];
		// If we have followed the key path down to a single key:
		if (keyPath.length == 1) {
			// Test if the desired operation is a value replacement. If so...
			const splitForValue = currentKeyPart.indexOf("=");
			if (splitForValue != -1) {
				// Check if the current object contains the desired key, and if it is set to the desired value
				const desiredKey = currentKeyPart.slice(0, splitForValue);
				const desiredValue = currentKeyPart.slice(splitForValue + 1);
				if (Object.keys(obj).includes(desiredKey) && obj[desiredKey] == desiredValue) {
					// If so, and a replacement was provided, replace with the replacement
					if (replacement) obj[desiredKey] = replacement;
					// Otherwise if the replacement is blank, delete the key
					else delete obj[desiredKey];
					return;
				}
				// [Falls out of this eventual block if that failed...]
			// The desired operation is otherwise a key replacement. Check if the current object
			// contains the desired key. If so...
			} else if (Object.keys(obj).includes(currentKeyPart)) {
				// If the replacement is specified as metadata, add it as a metadata entry
				if (replacement == "_") obj[obj[currentKeyPart]] = true;
				// If an explicit replacement was specified, rename the key.
				else if (replacement) obj[replacement] = obj[currentKeyPart];
				// In all cases, delete the existing leftover key.
				// (This is also the only thing that will trigger if the replacement was blank.)
				delete obj[currentKeyPart];
				return;
			}
			// [Falls out of this eventual block if that failed...]
		}
		
		// This will only trigger if A. the key path is of length > 1, and B. the current key
		// part is a key of the current object.
		if (Object.keys(obj).includes(currentKeyPart)) {
			// If so, repeat recursively under that key
			this.#renameKeysRecursive(obj[currentKeyPart], keyPath.slice(1), replacement);
			return;
		}
		// Otherwise if the current object is an array, repeat recursively under every value of the
		// array
		if (obj instanceof Array) {
			for (const branch of obj) {
				this.#renameKeysRecursive(branch, keyPath, replacement);
			}
			return;
		}
	}

	async query(): Promise<TimeseriesList | null> {
		const listSelection = this.listSelector.selection;
		if (!listSelection.label) return null;

		// If current selected option is cached, use cached value
		const cachedValue = this.listCache.get(listSelection.label);
		if (cachedValue !== undefined) return cachedValue;

		// Otherwise resolve each external reference in the list
		if (!listSelection.value) return null;
		const timeseriesLists: TimeseriesList[] = [];
		for (const reference of listSelection.value) {
			// Query URL
			// TODO: Should we determine whether it is a file vs. URL in a less-hacky way?
			// (Examples include comparing against the raw schemas, or adding a discriminator
			// to the schemas.)
			const response = reference.source.startsWith("blob") ?
				await NetworkUtils.queryUploadedFile(this.fileForm.files, "chronological-calculator-list-cache", reference.source) :
				await NetworkUtils.queryURL(reference.source, "chronological-calculator-list-cache");
			if (!response || !response.ok) continue;

			// Extract JSON-esque data from response
			let responseJSON: any;
			try {
				responseJSON = await response.json();
			} catch {
				continue;
			}

			// For each entry to change in the reference's mapper:
			Object.entries(reference.mapper).forEach(
				([key, value]) => {
					// Determine the sequence of keys needed to be traversed to reach the key/value
					// we desire to change
					const keyPath = key.split(":");
					// console.log(keyPath, value, responseJSON);
					// Then recursively iterate through the object until we either find the keys
					// or exhaust the key path.
					this.#renameKeysRecursive(responseJSON, keyPath, value);
					// console.log(keyPath, value, responseJSON);
				}
			);

			// TimeseriesList assumes the root object is a key-value object, not an array.
			// If the retrieved JSON is an array, we solve the problem by placing it inside a
			// suitable key-value object.
			if (responseJSON instanceof Array) {
				responseJSON = {entries: responseJSON}
			}
			// Add last modified date, if applicable
			if (!Object.keys(responseJSON).includes("lastModified")) {
				Object.assign(responseJSON, {lastModified: response.headers.get("Last-Modified")});
			}

			// Attempt to parse as TimeSeries list
			let parsedResponse: TimeseriesList;
			try {
				parsedResponse = timeseriesListSchema.parse(responseJSON);
			} catch {
				continue;
			}
			// Add original source as a source for each entry in the list, and add to list of timeseries lists
			for (const entry of parsedResponse.entries) {
				entry.sources.push(reference.source);
			}
			timeseriesLists.push(parsedResponse);
			
		}

		// Merge the timeseries lists together.
		for (let i = 1; i < timeseriesLists.length; ++i) {
			const otherList = timeseriesLists[i];
			// Merge entries...
			timeseriesLists[0].entries = timeseriesLists[0].entries.concat(otherList.entries).sort(
				(a, b) => b.timestamp.getTime() - a.timestamp.getTime()
			);
			// Merge datetime resolution and metadata...
			timeseriesLists[0].highResolution ||= otherList.highResolution;
			timeseriesLists[0].metadata = [...new Set(
				timeseriesLists[0].metadata.concat(otherList.metadata)
			)];
			// Merge default labels...
			if (timeseriesLists[0].defaultLabel == "entry without metadata" && otherList.defaultLabel != "entry without metadata") {
				timeseriesLists[0].defaultLabel = otherList.defaultLabel;
			}
			// Merge lastModified dates...
			if (!timeseriesLists[0].lastModified) {
				timeseriesLists[0].lastModified = otherList.lastModified;
			} else if (!otherList.lastModified) {}
			else if (timeseriesLists[0].lastModified instanceof Date) {
				if (otherList.lastModified instanceof Date) {
					timeseriesLists[0].lastModified = [timeseriesLists[0].lastModified, otherList.lastModified];
				} else {
					timeseriesLists[0].lastModified = [timeseriesLists[0].lastModified].concat(otherList.lastModified);
				}
			} else {
				if (otherList.lastModified instanceof Date) {
					timeseriesLists[0].lastModified.push(otherList.lastModified);
				} else {
					timeseriesLists[0].lastModified = timeseriesLists[0].lastModified.concat(otherList.lastModified);
				}
			}
		}
		// console.log(timeseriesLists, timeseriesLists.length);
		const timeseriesList = timeseriesLists[0];

		// Cache and return
		this.listCache.set(listSelection.label, timeseriesList);
		return timeseriesList;
	}
}