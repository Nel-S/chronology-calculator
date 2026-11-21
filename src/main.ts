import "./assets/style.css";
import {DatetimeWithMemory} from "./components/datememory.js";
import {ListSelector} from "./components/list-selector.js";
import {ModeOrderSelector} from "./components/mode-order-selector.js";
import {ModeRangeSelector} from "./components/mode-range-selector.js";
import {DateUtils, ElementUtils, StringUtils} from "./util.js"
import {type TimeseriesList, TimeseriesListMethods} from "./lists.js";

const modeOrder = new ModeOrderSelector(
	"#mode-form-order",
	"#mode-form-split-by-metadata"
);
const modeRange = new ModeRangeSelector(
	"#mode-form-range",
	"#date-exclusive-bound-form"
);

const listSelector = new ListSelector(
	"#list-form",
	"#list-form-url",
	"#list-form-file-upload"
);

const startDatetimeWithMemory = new DatetimeWithMemory(
	"#datetime-start-form",
	"#utc-offset-start-form"
);

const endDatetimeWithMemory = new DatetimeWithMemory(
	"#datetime-end-form",
	"#utc-offset-end-form"
);

async function initialize(): Promise<void> {
	// Reset list cache.
	await caches.delete("chronological-calculator-list-cache");

	// Add event listeners.
	const modeOrderForm = ElementUtils.getElementOrThrow<HTMLSelectElement>("#mode-form-order");
	modeOrderForm.addEventListener("input", async function(){await recalculate();});

	const modeRangeForm = ElementUtils.getElementOrThrow<HTMLSelectElement>("#mode-form-range");
	modeRangeForm.addEventListener("input", async function(){await recalculate();});

	const modeSplitByMetadataForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#mode-form-split-by-metadata");
	modeSplitByMetadataForm.addEventListener("input", async function(){await recalculate();});

	const listForm = ElementUtils.getElementOrThrow<HTMLSelectElement>("#list-form");
	listForm.addEventListener("input", async function(){await respondToNewList();});

	const listURLForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#list-form-url");
	listURLForm.addEventListener("change", async function(){blankOutputs("[Processing...]"); await updatePageForList();});

	const listFileUploadForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#list-form-file-upload");
	listFileUploadForm.addEventListener("change", async function(){blankOutputs("[Processing...]");await updatePageForList();});

	const startDateForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#datetime-start-form");
	startDateForm.addEventListener("input", async function(){await recalculate();});

	const startUTCOffsetForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#utc-offset-start-form");
	startUTCOffsetForm.addEventListener("input", async function(){await recalculate();});

	const endDateForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#datetime-end-form");
	endDateForm.addEventListener("input", async function(){await recalculate();});

	const endUTCOffsetForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#utc-offset-end-form");
	endUTCOffsetForm.addEventListener("input", async function(){await recalculate();});

	const dateExclusiveBoundForm = ElementUtils.getElementOrThrow<HTMLInputElement>("#date-exclusive-bound-form");
	dateExclusiveBoundForm.addEventListener("input", async function(){await recalculate();});
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
		endDatetimeWithMemory.show();
		return false;
	}
	
	blankOutputs(`[Waiting${urlUnhidden ? " for URL" : fileUploadUnhidden ? " for file upload" : ""}...]`);
	endDatetimeWithMemory.hide();
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

async function updatePageForList(): Promise<void> {
	const list = await listSelector.query();
	if (!list) {
		blankOutputs(`[Invalid list]`);
		return;
	}

	blankOutputs(`[Calculating...]`);
	updateDatetimeResolution(list);
	updateListLastUpdateField(list);
	await recalculate(list);
}

// Update the datetime resolution to match the current list.
function updateDatetimeResolution(list: TimeseriesList): boolean {
	if (list && list.highResolution) {
		startDatetimeWithMemory.toHighResolution();
		endDatetimeWithMemory.toHighResolution();
		return true;
	}
	startDatetimeWithMemory.toLowResolution();
	endDatetimeWithMemory.toLowResolution();
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

async function recalculate(list: TimeseriesList | null = null): Promise<void> {
	if (list == null) list = await listSelector.query();
	if (!list) {
		blankOutputs(`[Invalid list]`);
		return;
	}
	const startDatetime = startDatetimeWithMemory.read();
	if (!startDatetime) {
		blankOutputs(`[Invalid start date/time]`);
		return;
	}
	const endDatetime = endDatetimeWithMemory.read();
	if (!endDatetime) {
		blankOutputs(`[Invalid end date/time]`);
		return;
	}
	
	const entryIndexRanges = modeRange.evaluate(list, {lower: startDatetime, upper: endDatetime});
	// console.log(`Entry index ranges:`);
	// console.log(entryIndexRanges);
	const entriesOrLists = modeOrder.evaluate(list, entryIndexRanges);
	// console.log(`Entry lists:`);
	// console.log(entriesOrLists, entriesOrLists.length);
	if (!entriesOrLists) {
		blankOutputs("[No entries exist]");
		return;
	}

	const outputContainer = ElementUtils.getElementOrThrow<HTMLDivElement>("#output-container");
	outputContainer.innerHTML = "";
	for (const entryOrList of entriesOrLists) {
		// console.log("Current entry list:");
		// console.log(entryOrList, entryOrList.length);
		if (!entryOrList) continue;
		if (entryOrList instanceof Array) {
			outputContainer.innerHTML += `<div class="stack-horizontally-wrap spaced">`;
			for (let i = 0; i < list.metadata.length + 1; ++i) {
				const currentEntry = entryOrList[i];
				// console.log("Current entry:");
				// console.log(currentEntry);
				let nameText: string;
				let timeText: string;

				if (!currentEntry) {
					nameText = "[None existed]";
					timeText = "";
				} else {
					nameText = TimeseriesListMethods.printLinkable(currentEntry);
					for (let j = 0; j < currentEntry.sources.length; ++j) {
						nameText += `<sup>${TimeseriesListMethods.printLinkable({
							name: `[${j + 1}]`,
							url: currentEntry.sources[j]
						})}</sup>`;
					}
					timeText = `~ ${list.highResolution ? DateUtils.extractDateAndTime(currentEntry.timestamp, true) + " UTC" : DateUtils.extractDate(currentEntry.timestamp)}`;
				}

				outputContainer.innerHTML += `
		<div class="should-fade-in">
			<p class="label">${StringUtils.capitalize(!i ? list.defaultLabel : list.metadata[i-1])}:</p>
			<p class="list-name">${nameText}</p>
			<p class="subtext">${timeText}</p>
		</div>`
			}
			outputContainer.innerHTML += `</div>`;
			console.group(outputContainer.innerHTML);
		} else {
			let nameText = TimeseriesListMethods.printLinkable(entryOrList);
			for (let j = 0; j < entryOrList.sources.length; ++j) {
				nameText += `<sup>${TimeseriesListMethods.printLinkable({
					name: `[${j + 1}]`,
					url: entryOrList.sources[j]
				})}</sup>`;
			}
			let subtext = `~ ${list.highResolution ? DateUtils.extractDateAndTime(entryOrList.timestamp, true) + " UTC" : DateUtils.extractDate(entryOrList.timestamp)}`;
			const currentEntryMetadata = Object.keys(entryOrList).filter(
				(key) => list.metadata.includes(key)
			);
			for (const metadata of (currentEntryMetadata.length ? currentEntryMetadata : [list.defaultLabel])) {
				subtext += `, ${metadata}`;
			}
			outputContainer.innerHTML += `
		<div class="should-fade-in">
			<p class="list-name">${nameText}</p>
			<p class="subtext">${subtext}</p>
		</div>`
		}
	}
}

window.addEventListener("DOMContentLoaded", initialize);