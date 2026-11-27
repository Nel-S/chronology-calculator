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

const fileSchema = z.url({
  protocol: /^blob$/,
  normalize: true,
  error: "Provided file URI is invalid."
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

export const externalSchema = z.object({
	source: z.xor([urlSchema, fileSchema]),
	mapper: z._default(z.optional(
		z.record(
			z.string(),
			z.string()
		)
	), {})
});
export type ExternalList = z.infer<typeof externalSchema>;

/* TODO: None of these can be converted to strictObjects without errors complaining about
   an unrecognized key "default". This is likely due to TypeScript's compiling. Is there
   any workaround?*/
const linkableSchema = z.object({
	name: z.string("Provided name for a linkable object is not a valid string."),
	url: urlSchema
});
export type Linkable = z.infer<typeof linkableSchema>;

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
		/* TODO: Possibly migrate metadata to dictionary.
		   However, this would break backwards compatibility. */
		// metadata: z._default(z.optional(
		// 	z.record(
		// 		z.string(),
		// 		z.string()
		// 	)
		// ), {})
	}),
	// All other keys are considered metadata, and must be Boolean
	/** @deprecated */
	z.boolean()
);
export type Entry = z.infer<typeof entrySchema>;

export const timeseriesListSchema = z.pipe(
	// Attributes pulled from JSON
	z.object({
		entries: z.pipe(
			z.array(entrySchema),
			// Entries are sorted by time descending
			/* TODO: Determine whether list is generally ordered ascending or descending,
			   then break ties for entries with identical ties accordingly */
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
			z.xor([
				checkedDatetimeSchema,
				// z.tuple([checkedDatetimeSchema, checkedDatetimeSchema])
				z.array(checkedDatetimeSchema)
			]),
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
				(key) => !(key in entrySchema.shape)
			)
			// Then pass through a Set to remove duplicates
		))]
	}))
);
export type TimeseriesList = z.infer<typeof timeseriesListSchema>;