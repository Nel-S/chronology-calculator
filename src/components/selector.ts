import {ElementUtils} from "../util.js"

export class Selector<T, E extends HTMLElement> {
	element: E;
	mapper: Record<string, T>;

	constructor(elementID: string, mapper: Record<string, T> | null = null) {
		this.element = ElementUtils.getElementOrThrow<E>(elementID);
		this.mapper = {};
		this.reset();
		if (mapper) {
			Object.entries(mapper).forEach(
				([key, value]) => this.add(key, value)
			);
		}
	}

	reset(): Selector<T, E> {
		this.mapper = {};
		if (this.element instanceof HTMLSelectElement) {
			this.element.innerHTML = "<option selected disabled hidden>[Waiting for selection.]</option>";
		} else if (this.element instanceof HTMLInputElement) {
			this.element.value = "";
		}
		return this;
	}

	contains(label: string): boolean {
		return Object.keys(this.mapper).includes(label);
	}

	// list(): string[] {
	// 	return Array.from(this.mapper.keys());
	// }

	get selection(): {label: string | null, value: T | null} {
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

		const value = this.mapper[label] ?? null;
		return {
			label: label,
			value: value
		};
	}

	add(
		label: string,
		value: T
	): Selector<T, E> {
		if (this.mapper[label]) throw new Error(`Attempted to add entry with duplicate key "${label}" to Selector object.`);
		this.mapper[label] = value;
		if (this.element instanceof HTMLSelectElement) {
			this.element.add(new Option(label));
		}
		return this;
	}

	// addAll(
	// 	values: Iterable<[string, T]>
	// ): Selector<T, E> {
	// 	for (const [label, value] of values) this.add(label, value);
	// 	return this;
	// }

	// remove(label: string): Selector<T, E> {
	// 	this.mapper.delete(label);
	// 	if (this.element instanceof HTMLSelectElement) {
	// 		for (let i = this.element.options.length - 1; i; --i) {
	// 			if (this.element[i].label === label) this.element.remove(i);
	// 		}
	// 	}
	// 	return this;
	// }

	// removeAll(
	// 	labels: Iterable<string>
	// ): Selector<T, E> {
	// 	for (const label of labels) this.remove(label);
	// 	return this;
	// }

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