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
					"release_time": "timestamp",
					// "type": "_"
				}
			}),
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
		switch (this.listSelector.get().label) {
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
		return true;
	}

	async query(): Promise<TimeseriesList | null> {
		const listSelection = this.listSelector.get();
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
			if (!response || !response.ok) return null;
			try {
				// Extract list data, and add last modified date if present
				const responseJSON: JSON = await response.json();
				if (!Object.keys(responseJSON).includes("lastModified")) {
					Object.assign(responseJSON, {lastModified: response.headers.get("Last-Modified")});
				}
				// TODO: Ultimately enable changing metadata keys...
				// for (const key in reference.mapper) {
				// 	const value = reference.mapper[key];
				// 	if (!Object.keys(responseJSON).includes(key)) continue;
				// 	Object.defineProperty(responseJSON, value, responseJSON[key]); // <-- not Valid
				// }
				return timeseriesListSchema.parse(responseJSON);
			} catch {
				return null;
			}
		}
		// Combine timeseries lists together
		// TODO: Implement. This is a temporary hack.
		const timeseriesList = timeseriesLists[0]

		// Cache and return
		this.listCache.set(listSelection.label, timeseriesList);
		return timeseriesList;
	}
}