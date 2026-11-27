import "./assets/style.css";
import {DatetimeWithMemory} from "./components/datememory.js";
import {ListSelector} from "./components/list-selector.js";
import {ModeOrderSelector} from "./components/mode-order-selector.js";
import {ModeRangeSelector} from "./components/mode-range-selector.js";
import {OutputWindow} from "./components/output-window.js";
import {type TimeseriesList} from "./lists.js";

/* TODO: With the current event listener setup, this has to be imported first for its shoe/hide buttons
   to update properly, which is not a good thing.
   The datetime objects, when rewritten, will probably need to log the last-received list and mode orders,
   and update the interactability of its forms respectively.*/
const startDatetimeWithMemory = new DatetimeWithMemory(
	"#datetime-start-form",
	"#utc-offset-start-form"
);
const endDatetimeWithMemory = new DatetimeWithMemory(
	"#datetime-end-form",
	"#utc-offset-end-form"
);
// Event listeners for datememories
// TODO: Move to datememory.ts after that file is rewritten
window.addEventListener("list-change", (e) => {
	if (!(e instanceof CustomEvent)) throw new Error("Custom event listener did not receive a CustomEvent.");
	const listSelection = e.detail?.selection ?? "";
	if (listSelection == "From URL" || listSelection == "From File Upload") startDatetimeWithMemory.hide();
	else startDatetimeWithMemory.show();
});
window.addEventListener("list-change", (e) => {
	if (!(e instanceof CustomEvent)) throw new Error("Custom event listener did not receive a CustomEvent.");
	const listSelection = e.detail?.selection ?? "";
	if (listSelection == "From URL" || listSelection == "From File Upload") endDatetimeWithMemory.hide();
	else endDatetimeWithMemory.show();
});
window.addEventListener("mode-range-change", (e) => {
	if (!(e instanceof CustomEvent)) throw new Error("Custom event listener did not receive a CustomEvent.");
	const modeSelection = e.detail?.selection ?? "";
	if (modeSelection.endsWith("End Date")) startDatetimeWithMemory.hide();
	else startDatetimeWithMemory.show();
});
window.addEventListener("mode-range-change", (e) => {
	if (!(e instanceof CustomEvent)) throw new Error("Custom event listener did not receive a CustomEvent.");
	const modeSelection = e.detail?.selection ?? "";
	if (modeSelection.endsWith("Start Date")) endDatetimeWithMemory.hide();
	else endDatetimeWithMemory.show();
});

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
	const selection = listSelector.listSelector.selection.label;
	if (selection == "From URL" || selection == "From File Upload") return;
	// Otherwise, perform a recalculation.
	await onNewList();
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
	
	// console.log(`Dates:`, {lower: startDatetime, upper: endDatetime});
	const entryIndexRanges = modeRange.evaluate(list, {lower: startDatetime, upper: endDatetime});
	// console.log(`Entry index ranges:`, entryIndexRanges);
	const entriesOrMetadata = modeOrder.evaluate(list, entryIndexRanges);
	// console.log(`Entry lists:`, entriesOrMetadata, entriesOrMetadata.length);
	outputWindow.printEntries(list, entriesOrMetadata);
}

window.addEventListener("DOMContentLoaded", initialize);