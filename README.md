# Chronology Calculator

**[(Visit the webpage here)](https://nel-s.github.io/latest-version-calculator)**

Given a list of timestamped entries, this website finds the latest entries that satisfy a piece of metadata as of a particular date. For example:
- with a list of software release dates, it can find the latest full version and latest pre-release version on a particular date.
- with a list of political office-holders, it can find the latest members of each political party that held that position as of a particular date.

There are a few preset lists bundled with the page, as well as the option to upload your own, either as a JSON file or via a URL.

## Schemas
### Entries
Each entry in a timeseries list must be in JSON with the following keys:
- `name` (`string`): The entry's name.
- `timestamp` (`datetime-representing string`): The entry's timestamp. These can be either dates only, or dates with times.

The following keys are meanwhile optional:
- `url` (`HTTP/HTTPS URL`): If provided, adds a hyperlink to the entry's name, linking to the specified URL.
- `sources` (`Array of HTTP/HTTPS URLs`): If provided, adds citations to the entry's name, linking to each of the specified URLs.
- Any other keys, if provided, will be treated as metadata for the current entry, and must be `true`/`false`. (Examples include `pre-release: true` or `Libertarian: false`.)

Minimal example:
```json
{
    "name": "Joe's Wedding",
    "timestamp": "2023-06-21"
}
```
Comprehensive example:
```json
{
    "name": "April's Birthday Party",
    "timestamp": "2023-06-21T11:14:16Z",
    "url": "https://aprilsbday.example",
    "sources": [
        "https://socialmedia.example/post/123",
        "https://calendar.example/event/456"
    ],
    "birthday party": true,
    "event requiring registration": false
}
```

### Timeseries Lists
Timeseries lists must be in JSON with the following keys:
- `entries` (`Array of Entries`): The entries of the list.

The following keys are meanwhile optional:
- `defaultLabel` (`string`): If provided, the default label used for displaying entries without any metadata.
- `lastModified` (`datetime-representing string`): If provided, the last date/time the list was updated. (Some URLs or provided files will try to infer this automatically.)

Minimal example:
```json
{
    "entries": [
        {
            "name": "Joe's Wedding",
            "timestamp": "2023-06-21"
        }
    ]
}
```
Comprehensive example:
```json
{
    "entries": [
        {
            "name": "April's Birthday Party",
            "timestamp": "2023-06-21T11:14:16Z",
            "url": "https://aprilsbday.example",
            "sources": [
                "https://socialmedia.example/post/123",
                "https://calendar.example/event/456"
            ],
            "birthday party": true,
            "event requiring registration": false
        },
        {
            "name": "Steakhouse Dinner",
            "timestamp": "2023-06-23T18:15:00Z",
            "sources": [
                "https://calendar.example/event/789"
            ],
            "event requiring registration": true
        }
    ],
    "defaultLabel": "miscellaneous event",
    "lastModified": "2026-07-26T22:41:00Z"
}
```

## Miscellaneous

Acknowledgements are listed on the webpage itself. Bug reports, feature suggestions, and pull requests are all welcome.

This repository uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html), where (due to being a webpage and not a software library) the "public API" is considered to be the schema list above, plus all functionality the end user can interact with, and be communicated to in response via the web interface. This definition may grow in scope if endpoints or other methods of interaction are ever added.