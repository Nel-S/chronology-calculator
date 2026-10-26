import {ElementUtils} from "../util.js"

export class Selector<T, E extends HTMLElement> {
	element: E;
	mapper: Map<string, T>;
	selection: string | null = null;

	constructor(elementID: string) {
		this.element = ElementUtils.getElementOrThrow<E>(elementID);
		this.mapper = new Map();
		this.reset();
	}

	reset(): Selector<T, E> {
		this.mapper.clear();
		if (this.element instanceof HTMLSelectElement) {
			this.element.innerHTML = "<option selected disabled hidden>[No mode selected.]</option>";
		}
		return this;
	}

	list(): string[] {
		return Array.from(this.mapper.keys());
	}

	select(label: string): boolean {
		if (!this.mapper.has(label)) return false;
		if (this.element instanceof HTMLSelectElement) {
			let found = false;
			for (let i = 0; i < this.element.options.length; ++i) {
				if (this.element.options[i].label === label) {
					this.element.selectedIndex = i;
					found = true;
					break;
				}
			}
			if (!found) return false;
		}
		this.selection = label;
		return true;
	}

	get(): {label: string | null, value: T | null} {
		if (this.selection == null) return {label: null, value: null};
		const value = this.mapper.get(this.selection);
		return {
			label: this.selection,
			value: value != undefined ? value : null
		};
	}

	add(
		label: string,
		value: T
	): Selector<T, E> {
		if (this.mapper.has(label)) throw new Error(`Attempted to add entry with duplicate key "${label}" to Selector object.`);
		this.mapper.set(label, value);
		if (this.element instanceof HTMLSelectElement) {
			this.element.add(new Option(label));
		}
		return this;
	}

	addAll(
		values: Iterable<[string, T]>
	): Selector<T, E> {
		for (const [label, value] of values) this.add(label, value);
		return this;
	}

	remove(label: string): Selector<T, E> {
		this.mapper.delete(label);
		if (this.element instanceof HTMLSelectElement) {
			for (let i = this.element.options.length - 1; i; --i) {
				if (this.element[i].label === label) this.element.remove(i);
			}
		}
		return this;
	}

	removeAll(
		labels: Iterable<string>
	): Selector<T, E> {
		for (const label of labels) this.remove(label);
		return this;
	}
}