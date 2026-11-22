import "./assets/style.css";
import {DatetimeWithMemory} from "./components/datememory.js";
import {ListSelector} from "./components/list-selector.js";
import {ModeOrderSelector} from "./components/mode-order-selector.js";
import {ModeRangeSelector} from "./components/mode-range-selector.js";
import {OutputWindow} from "./components/output-window.js";
import {type TimeseriesList} from "./lists.js";

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
const outputWindow = new OutputWindow(
	"#output-container",
	"#list-last-updated"
);

async function initialize(): Promise<void> {
	// Reset list cache.
	await caches.delete("chronological-calculator-list-cache");

	// Add event listeners.
	modeOrder.orderSelector.element.addEventListener("input", async function(){await recalculate();});
	modeOrder.typeSelector.addEventListener("input", async function(){await recalculate();});
	modeRange.rangeSelector.element.addEventListener("input", async function(){await recalculate();});
	modeRange.inclusivitySelector.addEventListener("input", async function(){await recalculate();});

	listSelector.listSelector.element.addEventListener("input", async function(){await onListSelectorChange();});
	listSelector.urlForm.addEventListener("change", async function(){outputWindow.write("[Processing...]"); await onNewList();});
	listSelector.fileForm.addEventListener("change", async function(){outputWindow.write("[Processing...]");await onNewList();});

	startDatetimeWithMemory.dateElement.addEventListener("input", async function(){await recalculate();});
	startDatetimeWithMemory.utcOffsetElement.addEventListener("input", async function(){await recalculate();});
	endDatetimeWithMemory.dateElement.addEventListener("input", async function(){await recalculate();});
	endDatetimeWithMemory.utcOffsetElement.addEventListener("input", async function(){await recalculate();});
}

// Function to run whenever the selected list changes.
async function onListSelectorChange(): Promise<void> {
	/* Check if a Custom option was selected (in which case input elements' visibilities need
	   to be updated, but otherwise a recalculation doesn't need to be performed). */
	if (updateIfCustomUpload()) return;
	// Otherwise, perform a recalculation.
	await onNewList();
}

function updateIfCustomUpload(): boolean {
	switch (listSelector.listSelector.element.value) {
		case "From URL":
			outputWindow.write("[Waiting for URL...]");
			endDatetimeWithMemory.hide();
			return true;
		case "From File Upload":
			outputWindow.write("[Waiting for file upload...]");
			endDatetimeWithMemory.hide();
			return true;
		default:
			endDatetimeWithMemory.show();
			return false;
	}
}

async function onNewList(): Promise<void> {
	const list = await listSelector.query();
	if (!list) {
		outputWindow.write(`[Invalid list]`);
		return;
	}

	outputWindow.write(`[Calculating...]`);
	updateDatetimeResolution(list);
	outputWindow.setLastUpdated(list.lastModified);
	await recalculate();
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

async function recalculate(): Promise<void> {
	const list = await listSelector.query();
	if (!list) {
		outputWindow.write(`[Invalid list]`);
		return;
	}
	const startDatetime = startDatetimeWithMemory.read();
	if (!startDatetime) {
		outputWindow.write(`[Invalid start date/time]`);
		return;
	}
	const endDatetime = endDatetimeWithMemory.read();
	if (!endDatetime) {
		outputWindow.write(`[Invalid end date/time]`);
		return;
	}
	
	const entryIndexRanges = modeRange.evaluate(list, {lower: startDatetime, upper: endDatetime});
	// console.log(`Entry index ranges:`);
	// console.log(entryIndexRanges);
	const entriesOrMetadata = modeOrder.evaluate(list, entryIndexRanges);
	// console.log(`Entry lists:`);
	// console.log(entriesOrMetadata, entriesOrMetadata.length);
	if (!entriesOrMetadata || !entriesOrMetadata.length) {
		outputWindow.write("[No entries exist]");
		return;
	}
	outputWindow.printEntries(list, entriesOrMetadata);
}

window.addEventListener("DOMContentLoaded", initialize);