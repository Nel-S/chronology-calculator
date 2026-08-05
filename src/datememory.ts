import {DateUtils, ElementUtils} from "./util.js"

const VALID_TIMEZONES = new Map([
    [-12, "UTC-12"],
	[-11, "UTC-11"],
	[-10, "UTC-10"],
	[-9.5, "UTC-9:30"],
	[-9, "UTC-9"],
	[-8, "UTC-8"],
	[-7, "UTC-7"],
	[-6, "UTC-6"],
	[-5, "UTC-5"],
	[-4, "UTC-4"],
	[-3.5, "UTC-3:30"],
	[-3, "UTC-3"],
	[-2, "UTC-2"],
	[-1, "UTC-1"],
    [0, "UTC"],
	[1, "UTC+1"],
	[2, "UTC+2"],
	[3, "UTC+3"],
	[3.5, "UTC+3:30"],
	[4, "UTC+4"],
	[4.5, "UTC+4:30"],
	[5, "UTC+5"],
	[5.5, "UTC+5:30"],
	[5.75, "UTC+5:45"],
	[6, "UTC+6"],
	[6.5, "UTC+6:30"],
	[7, "UTC+7"],
	[8, "UTC+8"],
	[8.75, "UTC+8:45"],
	[9, "UTC+9"],
	[9.5, "UTC+9:30"],
	[10, "UTC+10"],
	[10.5, "UTC+10:30"],
	[11, "UTC+11"],
	[12, "UTC+12"],
	[12.75, "UTC+12:45"],
	[+13, "UTC+13"],
	[+14, "UTC+14"]
]);

export class DatetimeWithMemory {
    dateElement: HTMLInputElement
    utcOffsetElement: HTMLSelectElement

    highResolution: boolean
    lastHours: number | null;
    lastMinutes: number | null;

    constructor(dateID: string, utcOffsetID: string) {
        this.dateElement = ElementUtils.getElementOrThrow<HTMLInputElement>(dateID);
        this.utcOffsetElement = ElementUtils.getElementOrThrow<HTMLSelectElement>(utcOffsetID);
        for (const [value, label] of VALID_TIMEZONES.entries()) this.utcOffsetElement.add(new Option(label, value.toString()));

        this.highResolution = (this.dateElement.type == "datetime-local");
        this.lastHours = this.lastMinutes = null;
    }

    hide(): void {
        if (this.dateElement.parentElement) {
            this.dateElement.parentElement.classList.add("translucent");
            this.dateElement.parentElement.inert = true;
        }
        if (this.utcOffsetElement.parentElement) {
            this.utcOffsetElement.parentElement.classList.add("translucent");
            this.utcOffsetElement.parentElement.inert = true;
        }
    }

    show(): void {
        if (this.dateElement.parentElement) {
            this.dateElement.parentElement.classList.remove("translucent");
            this.dateElement.parentElement.inert = false;
        }
        if (this.utcOffsetElement.parentElement) {
            this.utcOffsetElement.parentElement.classList.remove("translucent");
            this.utcOffsetElement.parentElement.inert = false;
        }
    }

    reset(): void {
        // Get user's current datetime
        const datetime = new Date();
        const desiredValue = Math.round(-datetime.getTimezoneOffset()/15)/4;
        this.utcOffsetElement.value = VALID_TIMEZONES.has(desiredValue) ? desiredValue.toString() : "UTC";
        DateUtils.localToUTC(datetime);
        this.dateElement.value = (this.highResolution ? DateUtils.extractDateAndTime : DateUtils.extractDate)(datetime);
    }

    read(): Date | null {
        const datetime = DateUtils.getUTCDatetime(this.dateElement);
        if (datetime == null) return null;

        if (this.highResolution) datetime.setUTCMinutes(datetime.getUTCMinutes() - 60*Number(this.utcOffsetElement.value), 59, 999);
        else datetime.setUTCHours(23, 59, 59, 999);
	    return datetime;
    }

    save(): void {
        const datetime = DateUtils.getUTCDatetime(this.dateElement);
        if (datetime == null) throw new Error(`Tried to save an invalid datetime (${this.dateElement.value}).`);
        this.lastHours = datetime.getUTCHours();
        this.lastMinutes = datetime.getUTCMinutes();
    }

    load(): void {
        const datetime = DateUtils.getUTCDatetime(this.dateElement);
        if (datetime == null) throw new Error(`Tried to load an invalid datetime (${this.dateElement.value}).`);
        if (this.lastHours != null) datetime.setUTCHours(this.lastHours);
        if (this.lastMinutes != null) datetime.setUTCMinutes(this.lastMinutes);
        this.dateElement.value = DateUtils.extractDateAndTime(datetime);
    }

    toHighResolution(): void {
        this.highResolution = true;
        const currentDate = DateUtils.getUTCDatetime(this.dateElement);
        this.dateElement.type = "datetime-local";
        if (this.utcOffsetElement.parentElement && (
            !this.dateElement.parentElement || !this.dateElement.parentElement.inert
        )) {
            this.utcOffsetElement.parentElement.classList.remove("translucent");
            this.utcOffsetElement.parentElement.inert = false;
        }
        if (currentDate == null) this.reset();
        else {
            this.dateElement.value = DateUtils.extractDateAndTime(currentDate);
            this.load();
        }
    }

    toLowResolution(): void {
        const currentDate = DateUtils.getUTCDatetime(this.dateElement);
        if (currentDate != null) this.save();

        this.highResolution = false;
        this.dateElement.type = "date";
        if (this.utcOffsetElement.parentElement) {
            this.utcOffsetElement.parentElement.classList.add("translucent");
            this.utcOffsetElement.parentElement.inert = true;
        }
        if (currentDate == null) this.reset();
        else this.dateElement.value = DateUtils.extractDate(currentDate);
    }
}