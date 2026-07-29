export class DateUtils {
	static getUTCDatetime(element: HTMLInputElement): Date | null {
		// Element.valueAsDate does not work because it is often set to null
		// even when Element.value is already a valid date.
		const datetime = new Date(
			element.value.endsWith("Z") ? element.value : element.value + "Z"
		);
		return DateUtils.isValid(datetime) ? datetime : null;
	}
	static extractDate(date: Date): string {
		/* Date.toISOString will be in the format YYYY-MM-DDThh:mm:ss...
		                                          ^^^^^^^^^^
		*/
		return date.toISOString().slice(0, 10);
	}
	static extractTime(date: Date): string {
		/* Date.toISOString will be in the format YYYY-MM-DDThh:mm:ss...
		                                                     ^^^^^^^^
		*/
		return date.toISOString().slice(11, 19);
	}
	static extractDateAndTime(datetime: Date, humanReadable: boolean = false): string {
		/* Date.toISOString will be in the format YYYY-MM-DDThh:mm:ss...
		                                          ^^^^^^^^^^^^^^^^
		*/
		let newDatetime = datetime.toISOString().slice(0, 16);
		// If human readability is desired, replace T with a space
		if (humanReadable) newDatetime = newDatetime.replace("T", " ");
		return newDatetime;
	}
	static localToUTC(datetime: Date): Date {
		datetime.setMinutes(datetime.getMinutes() - datetime.getTimezoneOffset());
		return datetime;
	}
	static isValid(datetime: Date | null): boolean {
		return datetime != null && !isNaN(datetime.getTime());
	}
}

export class ElementUtils {
	static getIfNullOrNull<T>(value: T | null, getter: (...args: any[]) => T | null, ...args: any[]): T | null {
		if (value !== null) return value;
		value = getter(args);
		return value;
	}

	static getIfNullOrThrow<T>(value: T | null, getter: (...args: any[]) => T | null, ...args: any[]): T {
		if (value !== null) return value;
		value = getter(args);
		if (value === null) throw new Error(`Getter ${getter.name} could not update variable with a non-null value.`);
		return value;
	}

	static async asyncGetIfNullOrNull<T>(value: T | null, getter: (...args: any[]) => Promise<T | null>, ...args: any[]): Promise<T | null> {
		if (value !== null) return value;
		value = await getter(args);
		return value;
	}

	static async asyncGetIfNullOrThrow<T>(value: T | null, getter: (...args: any[]) => T | null, ...args: any[]): Promise<T> {
		if (value !== null) return value;
		value = await getter(args);
		if (value === null) throw new Error(`Getter ${getter.name} could not update variable with a non-null value.`);
		return value;
	}

	static getElementOrNull<T extends HTMLElement>(selectors: string): T | null {
		return document.querySelector<T>(selectors);
	}

	// Admittedly from Google Gemini
	static getElementOrThrow<T extends HTMLElement>(selectors: string): T {
		const element = document.querySelector<T>(selectors);
		if (!element) throw new Error(`No element with selectors \"${selectors}\" could be found.`);
		return element;
	}
}

export class NetworkUtils {
	static encodeURIIfNotAlready(uri: string) : string {
		return decodeURI(uri) == uri ? encodeURI(uri) : uri;
	}

	static encodeURIComponentIfNotAlready(uri: string) : string {
		return decodeURIComponent(uri) == uri ? encodeURIComponent(uri) : uri;
	}

	static async queryURL(url: string, cacheName: string | null = null, tryToGetLastModified: boolean = true): Promise<Response | null> {
		let fetchResponse: Response | undefined = undefined;

		// Check cache for URL, if applicable; return if found
		if (cacheName) {
			const cache = await caches.open(cacheName);
			fetchResponse = await cache.match(url);
			if (fetchResponse) return fetchResponse;
		}

		// Try requesting URL. Return null if an error occurs or the response isn't OK
		try {
			fetchResponse = await fetch(url);
		} catch {
			return null;
		}
		if (!fetchResponse.ok) return null;

		// If we should try to get the last modified date, and it isn't already a header:
		const previousLastModified = fetchResponse.headers.get("Last-Modified");
		if (tryToGetLastModified && (
			!previousLastModified || !DateUtils.isValid(new Date(previousLastModified))
		)) {
			// Check if it's from GitHub
			// TODO: Expand to GitLab? Other sites? More generally?
			const lastCommitDatetime = await NetworkUtils.getGithubLastCommit(url);
			// Headers are immutable, so we need to construct a brand-new Response object
			if (lastCommitDatetime) fetchResponse = new Response(fetchResponse.body, {
				headers: {"Last-Modified": lastCommitDatetime},
				status: fetchResponse.status,
				statusText: fetchResponse.statusText
			})
		}

		// Store in cache, if applicable, and return
		if (cacheName) {
			const cache = await caches.open(cacheName);
			await cache.put(url, fetchResponse.clone());
		}
		return fetchResponse;
	}

	static async queryUploadedFile(fileList: FileList | null, cacheName: string | null = null, fileHash: string | null = null): Promise<Response | null> {
		// Not providing a filelist only works if a cachename + file hash were provided, and a cache hit occurs
		if (!fileList || !fileList.length) {
			if (cacheName && fileHash) {
				const cache = await caches.open(cacheName);
				const fetchResponse = await cache.match(fileHash);
				if (fetchResponse) return fetchResponse;
			}
			// Otherwise we can't retrieve any files from the filelist, so return null
			return null;
		}

		const file = fileList[0];

		// Check cache for URL, if applicable; return if found
		if (cacheName && fileHash) {
			const cache = await caches.open(cacheName);
			const fetchResponse = await cache.match(fileHash);
			if (fetchResponse) return fetchResponse;
		}

		// Get last modified date, and roll new Response with file text + date header
		const lastModifiedDatetime = new Date(file.lastModified);
		const fetchResponse = new Response(
			await file.text(),
			DateUtils.isValid(lastModifiedDatetime) ?
				{headers: {"Last-Modified": lastModifiedDatetime.toUTCString()}} :
				undefined
		);
		if (!fetchResponse.ok) return null;

		// Store in cache, if applicable, and return
		if (cacheName && fileHash) {
			const cache = await caches.open(cacheName);
			await cache.put(fileHash, fetchResponse.clone());
		}
		return fetchResponse;
	}

	static async getGithubLastCommit(url: string | URL | null): Promise<string | null> {
		// Nulls return null
		if (!url) return null;
		// Strings get converted to URLs, or return null if impossible
		if (!(url instanceof URL)) {
			try {
				url = new URL(url);
			} catch {
				return null;
			}
		}
		// if (!url) return null;
		const whitelistedProtocols = new Set(["http:", "https:"]);
		if (!whitelistedProtocols.has(url.protocol)) return null;
		const whitelistedDomains = new Set(["github.com", "www.github.com", "raw.githubusercontent.com"]);
		if (!whitelistedDomains.has(url.hostname)) return null;

		// Possible formats:
		// raw.githubusercontent.com/OWNER/REPOSITORY/SHA/PATH (parameters 1, 2, 3, 4)
		// github.com/OWNER/REPOSITORY/blob/[SHA OR BRANCH]/PATH (parameters 1, 2, 4, 5)
		// raw.githubusercontent.com/OWNER/REPOSITORY/refs/heads/BRANCH/PATH (parameters 1, 2, 5, 6)
		const extraParameters = url.pathname.includes("/blob/") ? 1 :
			url.pathname.includes("/refs/heads/") ? 2 :
			0;
		const filepathParameters = url.pathname.split("/");
		if (filepathParameters.length < 5 + extraParameters) return null;
		const owner = filepathParameters[1];
		const repository = filepathParameters[2];
		const shaOrBranch = filepathParameters[3 + extraParameters];
		const path = filepathParameters.slice(4 + extraParameters).join("/");

		// Make an API request, returning null upon failure
		let response: Response;
		try {
			response = await fetch(`https://api.github.com/repos/${owner}/${repository}/commits?sha=${shaOrBranch}&path=${path}&per_page=1&page=1`)
		} catch {
			return null;
		}
		if (!response || !response.ok) return null;

		// Extract JSON, returning null upon failure
		let responseJSON: any;
		try {
			responseJSON = await response.json();
		} catch {
			return null;
		}
		// Follow the path that the API *should* provide, or return null if failed
		return responseJSON[0]?.commit?.committer?.date ?? null;
	}
}