import {ElementUtils} from "../util.js"

export class Selector<T, E extends HTMLElement> {
	element: E;
	mapper: Map<string, T>;

	constructor(elementID: string) {
		this.element = ElementUtils.getElementOrThrow<E>(elementID);
		this.mapper = new Map();
		this.reset();
	}

	reset(): Selector<T, E> {
		this.mapper.clear();
		if (this.element instanceof HTMLSelectElement) {
			this.element.innerHTML = "<option selected disabled hidden>[Waiting for selection.]</option>";
		} else if (this.element instanceof HTMLInputElement) {
			this.element.value = "";
		}
		return this;
	}

	contains(label: string): boolean {
		return this.mapper.has(label);
	}

	list(): string[] {
		return Array.from(this.mapper.keys());
	}

	get(): {label: string | null, value: T | null} {
		let label: string | null;
		if (this.element instanceof HTMLSelectElement && this.element.selectedOptions.length) {
			label = this.element.selectedOptions.item(0)?.label ?? null
		} else if (this.element instanceof HTMLInputElement) {
			label = this.element.value;
		} else {
			// throw new Error("Attempted to get value from an HTML element with an unsupported type.");
			label = null;
		}
		if (label == null) return {label: null, value: null};

		const value = this.mapper.get(label) ?? null;
		return {
			label: label,
			value: value
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

	hide(): Selector<T, E> {
		this.element.classList.add("translucent");
		this.element.inert = true;
		return this;
	}

	show(): Selector<T, E> {
		this.element.classList.remove("translucent");
		this.element.inert = false;
		return this;
	}
}