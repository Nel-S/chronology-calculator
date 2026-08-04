import "./assets/style.css";
import {DatetimeWithMemory} from "./datememory.js";
import {DateUtils, ElementUtils, NetworkUtils} from "./util.js"
import {type TimeseriesList, TimeseriesListMethods, timeseriesListSchema} from "./lists.js";

// TODO: This would work better as an ordered set than as an array.
const customUrls: string[] = []
let customFileUploadsCount: number = 0;

const datetimeWithMemory = new DatetimeWithMemory(
	"#datetime-form",
	"#utc-offset-form"
)

async function initialize(): Promise<void> {
	// Reset list cache.
	await caches.delete("chronological-calculator-list-cache");

	// Add event listeners.
	const listForm = ElementUtils.getElementOrThrow<HTMLSelectElement>("#list-form");
	listForm.addEventListener("input", async function(){await respondToNewList();});

	const listURLForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#list-form-url");
	listURLForm.addEventListener("change", async function(){blankOutputs("[Processing...]"); await updatePageForList();});

	const listFileUploadForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#list-form-file-upload");
	listFileUploadForm.addEventListener("change", async function(){blankOutputs("[Processing...]");await updatePageForList();});

	const dateForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#datetime-form");
	dateForm.addEventListener("input", async function(){await recalculate();});

	const utcOffsetForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#utc-offset-form");
	utcOffsetForm.addEventListener("input", async function(){updateRangeOutput(); await recalculate();});

	// Initialize the timezone range on the current timezone.
	updateRangeOutput();
}

// Function to run whenever the selected list changes.
async function respondToNewList(): Promise<void> {
	/* Check if a Custom option was selected (in which case input elements' visibilities need
	   to be updated, but otherwise a recalculation doesn't need to be performed). */
	if (maybeResetForCustomUpload()) return;
	// Otherwise, perform a recalculation.
	await updatePageForList();
}

function maybeResetForCustomUpload(): boolean {
	const urlUnhidden = updateURLVisibility();
	const fileUploadUnhidden = updateFileUploadVisibility();
	if (!urlUnhidden && !fileUploadUnhidden) {
		datetimeWithMemory.show();
		return false;
	}
	
	blankOutputs(`[Waiting${urlUnhidden ? " for URL" : fileUploadUnhidden ? " for file upload" : ""}...]`);
	datetimeWithMemory.hide();
	return true;
}

function blankOutputs(message: string = "") {
	const outputContainer = ElementUtils.getElementOrThrow<HTMLDivElement>("#output-container");
	outputContainer.innerHTML = `
		<div class="should-fade-in list-name">
			${message}
		</div>
	`;

	const listLastUpdatedBox = ElementUtils.getElementOrThrow<HTMLParagraphElement>("#list-last-updated");
	listLastUpdatedBox.innerText = "";
}

function updateCustomLists(newSelection: string | null = null): boolean {
	const listForm = ElementUtils.getElementOrThrow<HTMLSelectElement>("#list-form");
	const customOptionsGroup = ElementUtils.getElementOrThrow<HTMLOptGroupElement>("#custom-lists");

	// Save current list selection
	const currentListValue = listForm.value;

	// Blank
	customOptionsGroup.innerHTML = "";
	// Add Custom URLs
	for (let i = 0; i < customUrls.length; ++i) customOptionsGroup.innerHTML += `<option>Custom URL #${i + 1}</option>`;
	// Add Custom Files
	for (let i = 0; i < customFileUploadsCount; ++i) customOptionsGroup.innerHTML += `<option>Custom File #${i + 1}</option>`;
	// Add URL/File upload options
	customOptionsGroup.innerHTML += `<option>From URL</option><option>From File Upload</option>`;

	// Restore current list selection
	listForm.value = newSelection ? newSelection : currentListValue;
	if (newSelection && newSelection != currentListValue) {
		maybeResetForCustomUpload();
	}
	return true;
}

async function updatePageForList(): Promise<void> {
	const list = await getListFromForm(true);
	if (!list) {
		blankOutputs(`[Invalid list]`);
		return;
	}

	updateOutputBoxes(list);
	updateDatetimeResolution(list);
	updateListLastUpdateField(list);
	await recalculate(list);
}

// Update the UTC offset output to match the corresponding slider's value.
function updateRangeOutput(): boolean {
	// Get elements
	const utcOffsetForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#utc-offset-form");
	const currentUtcOffsetOutput = ElementUtils.getElementOrThrow<HTMLParagraphElement>("#current-utc-offset");

	currentUtcOffsetOutput.innerText = `(UTC${Number(utcOffsetForm.value) > 0 ? "+" : ""}${utcOffsetForm.value != "0" ? utcOffsetForm.value : ""})`;
	return true;
}

// Update the datetime resolution to match the current list.
function updateDatetimeResolution(list: TimeseriesList): boolean {
	if (list && list.highResolution) {
		datetimeWithMemory.toHighResolution();
		return true;
	}
	datetimeWithMemory.toLowResolution();
	return false;
}

function updateURLVisibility(): boolean {
	const listForm = ElementUtils.getElementOrNull<HTMLSelectElement>("#list-form");
	const listURLForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#list-form-url");

	if (listForm && listForm.value === "From URL") {
		listURLForm.classList.remove("hidden");
		return true;
	}
	listURLForm.classList.add("hidden");
	listURLForm.value = "";
	return false;
}

function updateFileUploadVisibility(): boolean {
	const listForm = ElementUtils.getElementOrNull<HTMLSelectElement>("#list-form");
	const listFileUploadForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#list-form-file-upload");

	if (listForm && listForm.value === "From File Upload") {
		listFileUploadForm.classList.remove("hidden");
		return true;
	}
	listFileUploadForm.classList.add("hidden");
	return false;
}

function updateOutputBoxes(list: TimeseriesList): boolean {
	if (!list) return false;
	const outputContainer = ElementUtils.getElementOrThrow<HTMLDivElement>("#output-container");

	outputContainer.innerHTML = "";
	for (let i = 0; i < list.metadata.length + 1; ++i) {
		outputContainer.innerHTML += `
		<div class="should-fade-in" id="output-box-${i}">
			<p class="label">Latest ${!i ? list.defaultLabel : list.metadata[i-1]}:</p>
			<p class="list-name" id="output-name-${i}">[Calculating...]</p>
			<p class="subtext" id="output-time-${i}"></p>
		</div>
		`
	}
	return true;
}

function updateListLastUpdateField(list: TimeseriesList): boolean {
	if (!list) return false;
	const listLastUpdatedBox = ElementUtils.getElementOrThrow<HTMLParagraphElement>("#list-last-updated");

	if (list.lastModified && DateUtils.isValid(list.lastModified)) {
		const MILLISECONDS_PER_DAY = 86400000;
		listLastUpdatedBox.innerText = `This list was last updated ${Math.floor((new Date().valueOf() - list.lastModified.valueOf())/MILLISECONDS_PER_DAY)} days ago.`;
	} else {
		listLastUpdatedBox.innerText = `It is unknown when this list was last updated.`;
	}
	return true;
}

function getListURLOrHashKey(selection: string, optgroup: string | null = null, urlFormID: string | null = null): string | null {
	// Check if the selection is a preset list (not under the "Custom" optgroup)
	if (optgroup != "Custom") {
		return `https://raw.githubusercontent.com/Nel-S/chronology-calculator/refs/heads/development/preset-lists/${optgroup ? NetworkUtils.encodeURIComponentIfNotAlready(optgroup) + "/" : ""}${NetworkUtils.encodeURIComponentIfNotAlready(selection)}.json`;
	}
	if (selection == "From URL" && urlFormID) {
		// Uploading new URL: extract URL from form
		const URLForm = ElementUtils.getElementOrNull<HTMLInputElement>(urlFormID);
		if (!URLForm || !URLForm.value) return null;
		return NetworkUtils.encodeURIIfNotAlready(`${!URLForm.value.match(/^https?:\/\//) ? "https://" : ""}${URLForm.value}`);
	}
	if (selection == "From File Upload") {
		// Uploading new file: hash key is "Custom File #1", etc.
		// (file extraction) occurs in NetworkUtils.queryUploadedFile()
		return NetworkUtils.encodeURIComponentIfNotAlready(`Custom File #${customFileUploadsCount + 1}`);
	}
	if (selection.startsWith("Custom URL #")) {
		// Custom URLs: follow the naming convention "Custom URL #1",
		// so the text after the last "#" should be the entry's index + 1.
		let index: number;
		try {
			index = Number(selection.split("#").at(-1)) - 1;
			if (index < 0 || index >= customUrls.length) return null;
		} catch {
			return null;
		}
		// Corresponding URLs for stored custom URLs are stored in customUrls
		return NetworkUtils.encodeURIIfNotAlready(customUrls[index]);
	}
	if (selection.startsWith("Custom File #")) {
		// Custom files: follow the naming convention "Custom File #1",
		// so the text after the last "#" should be the entry's index + 1.
		let index: number;
		try {
			index = Number(selection.split("#").at(-1)) - 1;
			if (index < 0 || index >= customFileUploadsCount) return null;
		} catch {
			return null;
		}
		// Corresponding hash keys for stored custom files are simply "Custom File #1", etc. themselves
		return NetworkUtils.encodeURIComponentIfNotAlready(selection);
	}
	// We've run out of possibilities and it's an invalid list
	return null;
}

async function getListFromForm(getLastModifed: boolean = false): Promise<TimeseriesList | null> {
	const listForm = ElementUtils.getElementOrThrow<HTMLSelectElement>("#list-form");
	const listFileUploadForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#list-form-file-upload");
	
	const url = getListURLOrHashKey(
		listForm.value,
		listForm.selectedOptions[0].closest("optgroup")?.label ?? null,
		"#list-form-url"
	);
	if (!url) return null;

	// New file uploads are handled in queryUploadedFile
	const fetchResponse = (listForm.value == "From File Upload") ?
		await NetworkUtils.queryUploadedFile(listFileUploadForm.files, "chronological-calculator-list-cache", url) :
		// Everything else can be handled in queryURL. (Stored custom files should still result
		// in a cache hit, and if they don't, the function will return null anyways.)
		await NetworkUtils.queryURL(url, "chronological-calculator-list-cache", getLastModifed);
	if (!fetchResponse || !fetchResponse.ok) return null;

	// Extract list data, and add last modified date if present
	let timeseriesList: TimeseriesList;
	try {
		const responseJSON: JSON = await fetchResponse.json();
		if (!Object.keys(responseJSON).includes("lastModified")) {
			Object.assign(responseJSON, {lastModified: fetchResponse.headers.get("Last-Modified")});
		}
		// Parse list
		// TODO: Can we cache the parsed JSON lists instead of the original requests?
		timeseriesList = timeseriesListSchema.parse(responseJSON);
	} catch {
		return null;
	}
	if (!timeseriesList) return null;

	// Store custom URL, if applicable
	// TODO: Move this out of this function. getListFromForm shouldn't have side effects.
	if (listForm.value == "From URL") {
		const urlIndex = customUrls.indexOf(url);
		if (urlIndex == -1) {
			customUrls.push(url);
		}
		updateCustomLists(`Custom URL #${urlIndex == -1 ? customUrls.length : urlIndex + 1}`);
	}
	// Indicate another custom file was uploaded, if applicable
	// TODO: There is currently no way to detect duplicate uploads, like can be done with URLs...
	else if (listForm.value == "From File Upload") {
		++customFileUploadsCount;
		updateCustomLists(`Custom File #${customFileUploadsCount}`);
	}
	// Return list
	return timeseriesList;
}

async function recalculate(list: TimeseriesList | null = null): Promise<void> {
	list = await ElementUtils.asyncGetIfNullOrNull<TimeseriesList>(list, getListFromForm, false);
	if (!list) {
		blankOutputs(`[Invalid list]`);
		return;
	}
	const datetime = datetimeWithMemory.read();
	
	const latestEntryIndex = TimeseriesListMethods.getLatestEntryIndexOn(list, datetime);
	const latestEntriesList = TimeseriesListMethods.getFirstEntriesWithMetadata(list, latestEntryIndex);

	for (let i = 0; i < list.metadata.length + 1; ++i) {
		const outputBoxName = ElementUtils.getElementOrThrow<HTMLParagraphElement>(`#output-name-${i}`);
		const outputBoxTime = ElementUtils.getElementOrThrow<HTMLParagraphElement>(`#output-time-${i}`);
		if (!datetime) {
			outputBoxName.innerText = `[Invalid date/time]`;
			outputBoxTime.innerText = "";
			continue;
		}

		if (!latestEntriesList) {
			outputBoxName.innerText = `[None existed]`;
			outputBoxTime.innerText = "";
			continue;
		}

		const currentLatestEntry = latestEntriesList[i];
		if (!currentLatestEntry) {
			outputBoxName.innerText = `[None existed]`;
			outputBoxTime.innerText = "";
			continue;
		}

		outputBoxName.innerHTML = TimeseriesListMethods.printLinkable(currentLatestEntry);
		for (let j = 0; j < currentLatestEntry.sources.length; ++j) {
			outputBoxName.innerHTML += `<sup>${TimeseriesListMethods.printLinkable({
				name: `[${j + 1}]`,
				url: currentLatestEntry.sources[j]
			})}</sup>`;
		}
		outputBoxTime.innerText = `~ ${list.highResolution ? DateUtils.extractDateAndTime(currentLatestEntry.timestamp, true) + " UTC" : DateUtils.extractDate(currentLatestEntry.timestamp)}`;
	}
}

window.addEventListener("DOMContentLoaded", initialize);