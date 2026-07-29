import {DateUtils, ElementUtils} from "./util.js"

export class DatetimeWithMemory {
    dateElement: HTMLInputElement
    utcOffsetElement: HTMLInputElement
    utcOffsetWrapper: HTMLElement

    highResolution: boolean
    lastHours: number | null;
    lastMinutes: number | null;

    constructor(dateID: string, utcOffsetID: string, utcOffsetWrapperID: string) {
        this.dateElement = ElementUtils.getElementOrThrow<HTMLInputElement>(dateID);
        this.utcOffsetElement = ElementUtils.getElementOrThrow<HTMLInputElement>(utcOffsetID);
        this.utcOffsetWrapper = ElementUtils.getElementOrThrow<HTMLElement>(utcOffsetWrapperID);

        this.highResolution = (this.dateElement.type == "datetime-local");
        this.lastHours = this.lastMinutes = null;
        this.reset();
    }

    reset(): void {
        // Get user's current datetime
        const datetime = new Date();
        this.utcOffsetElement.value = (Math.round(-datetime.getTimezoneOffset()/15)/4).toString()
        DateUtils.localToUTC(datetime);
        this.dateElement.value = (this.highResolution ? DateUtils.extractDateAndTime : DateUtils.extractDate)(datetime);
    }

    read(): Date | null {
        const datetime = DateUtils.getUTCDatetime(this.dateElement);
        if (datetime == null) return null;

        if (this.highResolution) datetime.setUTCMinutes(datetime.getUTCMinutes() - 60*Number(this.utcOffsetElement.value));
        else datetime.setUTCHours(23, 59, 59);
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
        this.utcOffsetWrapper.classList.remove("hidden");
        if (currentDate == null) this.reset();
        else {
            this.dateElement.value = DateUtils.extractDateAndTime(currentDate);
            this.load();
        }
    }

    toLowResolution(): void {
        this.save();
        this.highResolution = false;
        const currentDate = DateUtils.getUTCDatetime(this.dateElement);
        this.dateElement.type = "date";
        this.utcOffsetWrapper.classList.add("hidden");
        if (currentDate == null) this.reset();
        else this.dateElement.value = DateUtils.extractDate(currentDate);
    }
}