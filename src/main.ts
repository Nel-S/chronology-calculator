import {DatetimeWithMemory} from "./datememory.js";
import {DateUtils, ElementUtils, NetworkUtils} from "./util.js"
import {type TimeseriesList, TimeseriesListMethods, timeseriesListSchema} from "./lists.js";

const customUrls: string[] = []
let customFileUploadsCount: number = 0;

const datetimeWithMemory = new DatetimeWithMemory(
	"#datetime-form",
	"#utc-offset-form",
	".input-utc-hires"
)

async function initialize(): Promise<void> {
	// Reset list cache.
	await caches.delete("chronological-calculator-list-cache");

	// Add event listeners.
	const listForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#list-form");
	listForm.addEventListener("input", async function(){await respondToNewList();});

	const listURLForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#list-form-url");
	listURLForm.addEventListener("change", async function(){await updatePageForList();});

	const listFileUploadForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#list-form-file-upload");
	listFileUploadForm.addEventListener("change", async function(){await updatePageForList();});

	const dateForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#datetime-form");
	dateForm.addEventListener("input", async function(){await recalculate();});

	const utcOffsetForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#utc-offset-form");
	utcOffsetForm.addEventListener("input", async function(){updateRangeOutput(); await recalculate();});

	// Call functions to initialize the page on the current list, date, and time.
	await respondToNewList();
	updateRangeOutput();
}

// Function to run whenever the selected list changes.
async function respondToNewList(): Promise<void> {
	/* Check if a Custom option was selected (in which case input elements' visibilities need
	   to be updated, but otherwise a recalculation doesn't need to be performed). */
	const urlUnhidden = updateURLVisibility();
	const fileUploadUnhidden = updateFileUploadVisibility();
	if (urlUnhidden || fileUploadUnhidden) {
		blankOutputs(`[Waiting${urlUnhidden ? " for URL" : fileUploadUnhidden ? " for file upload" : ""}...]`);
		return;
	}
	// Otherwise, perform a recalculation.
	await updatePageForList();
}

function blankOutputs(message: string = "") {
	const outputContainer = ElementUtils.getElementOrThrow<HTMLInputElement>("#output-container");
	outputContainer.innerHTML = `
		<div class="list-name">
			${message}
		</div>
	`;

	const listLastUpdatedBox = ElementUtils.getElementOrThrow<HTMLInputElement>("#list-last-updated");
	listLastUpdatedBox.innerText = "";
}

function updateCustomLists(): boolean {
	const listForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#list-form");
	const customOptionsGroup = ElementUtils.getElementOrThrow("#custom-lists");

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
	listForm.value = currentListValue;
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
	const currentUtcOffsetOutput = ElementUtils.getElementOrThrow<HTMLDataElement>("#current-utc-offset");

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
	const listForm = ElementUtils.getElementOrNull<HTMLInputElement>("#list-form");
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
	const listForm = ElementUtils.getElementOrNull<HTMLInputElement>("#list-form");
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
	const outputContainer = ElementUtils.getElementOrThrow<HTMLInputElement>("#output-container");

	outputContainer.innerHTML = "";
	for (let i = 0; i < list.metadata.length + 1; ++i) {
		outputContainer.innerHTML += `
		<div id="output-box-${i}">
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
	const listLastUpdatedBox = ElementUtils.getElementOrThrow<HTMLInputElement>("#list-last-updated");

	if (list.lastModified && DateUtils.isValid(list.lastModified)) {
		listLastUpdatedBox.innerText = `This list was last updated on ${DateUtils.extractDateAndTime(list.lastModified, true)} UTC.`;
	} else {
		listLastUpdatedBox.innerText = `This list was last updated on an unknown date.`;
	}
	return true;
}

async function getListFromForm(getLastModifed: boolean = false): Promise<TimeseriesList | null> {
	const listForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#list-form");
	const listFileUploadForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#list-form-file-upload");
	
	let url = "";
	switch (listForm.value) {
		// Preset lists
		case "Java Edition":
			// TODO: Replace with permalink?
			url = "https://raw.githubusercontent.com/Nel-S/latest-version-calculator/refs/heads/development/preset-lists/Minecraft Java Edition Versions.json";
			break;
		case "Xbox 360 Edition":
			url = "https://raw.githubusercontent.com/Nel-S/latest-version-calculator/refs/heads/development/preset-lists/Minecraft Xbox 360 Versions.json";
			break;
		// Uploading new URL: extract URL from form
		case "From URL":
			const listURLForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#list-form-url");
			if (!listURLForm.value) return null;
			url = `${!listURLForm.value.match(/^https?:\/\//) ? "https://" : ""}${listURLForm.value}`;
			break;
		// Uploading new file: hash key is "Custom File #1", etc.
		// (file extraction) occurs in NetworkUtils.queryUploadedFile()
		case "From File Upload":
			url = `Custom File #${customFileUploadsCount + 1}`;
			break;
		default:
			// See if the specified list is a stored custom URL/file.
			// Both follow the naming convention "Custom [URL/File] #1", etc., so if it is,
			// the text after the last "#" should be the entry's index + 1.
			let index: number;
			try {
				index = Number(listForm.value.split("#").at(-1)) - 1;
			} catch {
				// If it's not a number, we've run out of possibilities and it's an invalid list
				return null;
			}
			if (index < 0) return null;
			// Corresponding URLs for stored custom URLs are stored in customUrls
			if (listForm.value.startsWith("Custom URL #") && index < customUrls.length) {
				url = customUrls[index];
				break;
			}
			// Corresponding hash keys for stored custom files are simply "Custom File #1", etc. itself
			if (listForm.value.startsWith("Custom File #") && index < customFileUploadsCount) {
				url = listForm.value;
				break;
			}
			// Otherwise it's not a valid stored URL/file
			return null;
	}

	// New file uploads are handled in queryUploadedFile
	const fetchResponse = (listForm.value == "From File Upload") ?
		await NetworkUtils.queryUploadedFile(listFileUploadForm.files, "chronological-calculator-list-cache", url) :
		// Everything else can be handled in queryURL. (Stored custom files should still result
		// in a cache hit, and if they don't, the function will return null anyways.)
		await NetworkUtils.queryURL(url, "chronological-calculator-list-cache", getLastModifed);
	if (!fetchResponse || !fetchResponse.ok) return null;

	// Store custom URL, if applicable
	if (listForm.value == "From URL" && !customUrls.includes(url)) {
		customUrls.push(url);
		updateCustomLists();
	}
	// Indicate another custom file was uploaded, if applicable
	else if (listForm.value == "From File Upload" && !customUrls.includes(url)) {
		++customFileUploadsCount;
		updateCustomLists();
	}
	// Extract list data, and add last modified date if present
	try {
		const responseJSON: JSON = await fetchResponse.json();
		Object.assign(responseJSON, {lastModified: fetchResponse.headers.get("Last-Modified")});
		// Parse list and return
		// TODO: Can we cache the parsed JSON lists instead of the original requests?
		return timeseriesListSchema.parse(responseJSON);
	} catch {
		return null;
	}
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
		const outputBoxName = ElementUtils.getElementOrThrow(`#output-name-${i}`);
		const outputBoxTime = ElementUtils.getElementOrThrow(`#output-time-${i}`);
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