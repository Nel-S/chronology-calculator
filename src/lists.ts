import {z} from "zod/mini";
import {DateUtils} from "./util";

// Recommended URL parameters from Zod's documentation
const urlSchema = z.url({
  protocol: /^https?$/,
  // TODO: We may want to consider defining a whitelist
  hostname: z.regexes.domain,
  normalize: true,
  error: "Provided URL is invalid or non-HTTP/HTTPS."
});

const checkedDatetimeSchema = z.pipe(
	z.string("Provided timestamp or datetime is not a valid string."),
	z.transform((str, ctx) => {
		try {
			/* TypeScript cannot recognize that a transform with getUTCDatetimeOrNull, followed
			   by a refine ensuring it is not null, will actually guarantee all subsequent
			   invocations will never be null.*/
			return DateUtils.getUTCDatetimeOrThrow(str);
		} catch (e) {
			ctx.issues.push({
				code: "custom",
				message: "Provided string could not be converted to a Date object, or could not be converted to UTC.",
				input: str
			});
			return z.NEVER;
		}
	})
)

// TODO: None of these can be converted to strictObjects without errors complaining about an unrecognized key "default". This is likely due to TypeScript's compiling. Is there any workaround?
const linkableSchema = z.object({
	name: z.string("Provided name for a linkable object is not a valid string."),
	url: urlSchema
});
type Linkable = z.infer<typeof linkableSchema>;

const entrySchema = z.catchall(
	// Base schema
	z.object({
		...linkableSchema.shape,
		timestamp: checkedDatetimeSchema,
		// URLs are optional in entries
		url: z._default(z.optional(
			urlSchema
		), ""),
		// Sources are optional and default to an empty list if unprovided
		sources: z._default(z.optional(
			z.array(urlSchema)
		), []),
	}),
	// All other keys are considered metadata, and must be Boolean
	z.boolean()
);
type Entry = z.infer<typeof entrySchema>;

export const timeseriesListSchema = z.pipe(
	// Attributes pulled from JSON
	z.object({
		entries: z.pipe(
			z.array(entrySchema),
			// Entries are sorted by time descending
			z.transform(
				(entries) => [...entries].sort(
					(a, b) => b.timestamp.getTime() - a.timestamp.getTime()
				)
			)
		),
		// Default label to use for entries without metadata
		defaultLabel: z._default(z.optional(
			z.string("Provided name for a source is not a valid string.")
		), "entry without metadata"),
		lastModified: z._default(z.optional(z.nullable(
			checkedDatetimeSchema,
		)), null)
	}),
	// Derived attributes
	z.transform((data) => ({
		...data,
		// Whether list contains timestamp data (versus only dates)
		highResolution: data.entries.some(
			(entry) => DateUtils.extractTime(entry.timestamp) != "00:00:00"
		),
		// List of metadata keys contained in list's entries
		metadata: [...new Set(data.entries.flatMap(
			// For each entry, get keys in the entry that aren't in the entry schema
			(entry) => Object.keys(entry).filter(
				(key) => !Object.keys(entrySchema.shape).includes(key)
			)
			// Then pass through a Set to remove duplicates
		))]
	}))
);
export type TimeseriesList = z.infer<typeof timeseriesListSchema>;

export class TimeseriesListMethods {

	static printLinkable<T extends Linkable>(linkable: T): string {
		if (!linkable.url) return linkable.name;
		return `<a href="${linkable.url}" title="${linkable.url}">${linkable.name ? linkable.name : linkable.url}</a>`;
	}

	static getLatestEntryIndexOn(list: TimeseriesList | null, date: Date | null) : number | null {
		if (!list || !list.entries || !date) return null;

		// Find the minimum i such that date >= list.entries[i].
		// = Either date >= list.entries[0], or for i > 1, find i such that list.entries[i - 1] > date >= list.entries[i].
		let latestIndex = 0, earliestIndex = list.entries.length - 1;
		let found = false;
		// While there's still a range of indices to check:
		while (latestIndex <= earliestIndex) {
			// Get (approximate) middle index
			const middleIndex = Math.floor((latestIndex + earliestIndex)/2);
			// If not (date >= list.entries[i]), we can discard entries 0-i
			if (date < list.entries[middleIndex].timestamp) {
				latestIndex = middleIndex + 1;
				continue;
			}
			// If not (list.entries[i - 1] > date), we can discard entries i-end
			if (middleIndex > 0 && list.entries[middleIndex - 1].timestamp <= date) {
				earliestIndex = middleIndex - 1;
				continue;
			}
			// Otherwise list.entries[i - 1] > date >= list.entries[i] as desired
			latestIndex = middleIndex;
			found = true;
			break;
		}
		if (!found) return null;

		return latestIndex;
	}

	static getFirstEntriesWithMetadata(list: TimeseriesList | null, latestIndex: number | null = 0) : (Entry | null)[] | null {
		if (!list || !list.metadata || latestIndex === null) return null;

		// The ultimate array of first entries to be outputted.
		const firstEntries: (Entry | null)[] = new Array(list.metadata.length + 1).fill(null);
		// A "metadata -> firstEntries index" mapping, for convienence.
		const metadataIndices = Object.fromEntries(
			list.metadata.map((metadata, index) => [metadata, index + 1])
		);
		
		// For each entry from the latest-index entry onwards, unless all first entries are found:
		for (let i = latestIndex; i < list.entries.length && firstEntries.some((entry) => entry === null); ++i) {
			// Get metadata keys in current entry
			const currentEntryMetadata = Object.keys(list.entries[i]).filter(
				(key) => list.metadata.includes(key)
			);
			// If none exist, the entry is a candidate for the default output box, unless an earlier
			// one's already been found for it
			if (!currentEntryMetadata.length) {
				if (firstEntries[0] === null) firstEntries[0] = list.entries[i];
			} else {
				// Otherwise, drop metadata that already has a first entry, and assign all remaining as having the current entry as their 
				currentEntryMetadata.filter((datum) => firstEntries[metadataIndices[datum]] == null).forEach((datum) => firstEntries[metadataIndices[datum]] = list.entries[i]);
			}
		}
		return firstEntries;
	}
};