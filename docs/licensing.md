# Data sources, licensing and attribution

Last reviewed: 26 September 2026.

This page records what has and has not been established about the right to use
each upstream source. Where terms could not be found, that is stated plainly
rather than treated as permission.

## Summary

| Source | Status | Risk |
|---|---|---|
| OpenFreeMap / OpenMapTiles / OpenStreetMap | Explicitly permitted | Low |
| Software dependencies | All permissive licences | Low |
| IBM Plex fonts | SIL Open Font License 1.1 | Low |
| Vercel Hobby | Non-commercial only | Low, with conditions |
| ThaiWater / HII | **No published terms** | **Unresolved** |
| Traffy Fondue / NECTEC | **No published terms** | **Unresolved** |

Two of the three data sources publish no terms of use at all. This project
therefore operates on a good-faith basis: attribute clearly, poll politely,
identify the client honestly, and stop immediately on request. That is a
reasonable posture for a free non-commercial public-safety tool, but it is not
the same as permission, and it should not be described as such.

## ThaiWater — Hydro-Informatics Institute (สสน. / HII)

- Endpoints used: `api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load`
  and `.../rain_24h`. These are the same public endpoints that thaiwater.net's
  own front end calls. No key, no registration, no authentication.
- `https://www.thaiwater.net/robots.txt` contains `User-agent: *` with **no
  `Disallow` rules** — nothing is disallowed to automated clients.
  `api-v3.thaiwater.net` serves no robots.txt (404).
- A formal data standard is published at `standard.thaiwater.net`, including API
  documentation. It specifies technical requirements only. It states **no**
  licence, terms of use, authentication requirement, or redistribution policy.
  Its footer reads "Copyright © 2024 Hydro-Informatics Institute … All rights
  reserved."
- No HII datasets were found on Thailand's open-data portal `data.go.th`, so no
  standard government open-data licence attaches by that route.
- No rate-limit headers are returned and no rate limit is documented.

**Conclusion: silent, not permissive.** There is no published grant of rights
and no published prohibition. Written confirmation from HII should be obtained
before this is treated as settled.

**Mitigations in place:** requests identify the client via a `User-Agent`
naming the project and its repository; water levels are polled at the upstream
publication cadence (10 minutes) and the 4.5 MB rainfall feed no more than
every 30 minutes; attribution to สสน. / HII is displayed wherever the data is.

## Traffy Fondue — Bangkok Metropolitan Administration × NECTEC

- Endpoint used: `publicapi.traffy.in.th/teamchadchart-stat-api/geojson/v1`.
  Public, no key, no authentication. Serves no robots.txt (404).
- NECTEC publishes an *Exchange API* for agencies sending data **into** the
  platform. That is a different API from the public read endpoint used here, and
  its documentation does not cover redistribution of published complaints.
- Some Traffy Fondue source repositories are MIT licensed. That covers their
  **code**, not the complaint data.
- No terms of use, licence, or redistribution policy was found for the public
  data endpoint.

**Conclusion: silent, not permissive.** Same posture as above; written
confirmation from NECTEC or BMA should be obtained.

### Personal data

Traffy complaint text is written by members of the public and sometimes contains
phone numbers and house numbers. It is already public upstream, but
concentrating it on a third-party map changes the exposure. This project
therefore:

- prefers the upstream abstracted summary over the raw complaint text;
- strips phone numbers, house numbers and contact blocks when the raw text must
  be used;
- never sends any of it to analytics.

This is a deliberate reduction below what upstream publishes. Thailand's
Personal Data Protection Act should be reviewed properly before any wider
release, particularly if complaint text is ever surfaced in bulk or archived.

## OpenFreeMap, OpenMapTiles, OpenStreetMap

Explicitly permitted, including commercial use, with no request limits:

> "Commercial usage: Yes." · "There are no limits on the number of map views or requests."

Required attribution, displayed in the source strip beneath the map:

> OpenFreeMap © OpenMapTiles Data from OpenStreetMap

OpenStreetMap data is ODbL 1.0. The OpenFreeMap project itself is MIT.

## Software

Every direct dependency is under a permissive licence — verified from the
installed packages, not from memory:

| Licence | Packages |
|---|---|
| MIT | next, react, react-dom, next-intl, drizzle-kit, swr, zod, pino, tailwindcss, vitest, tsx, eslint, server-only |
| Apache-2.0 | drizzle-orm, h3-js, typescript, @playwright/test |
| BSD-3-Clause | maplibre-gl |
| BSD-2-Clause | dotenv |
| ISC | supercluster |
| Unlicense | postgres |
| SIL OFL 1.1 | IBM Plex Sans, IBM Plex Sans Thai, IBM Plex Mono |

Nothing copyleft, nothing with a field-of-use restriction.

## Hosting

Vercel's Hobby plan is **non-commercial personal use only**; commercial use
requires Pro. Vercel defines commercial usage as any deployment used for the
financial gain of anyone involved in producing it, including advertising,
payment processing, and affiliate linking.

Vercel states explicitly that **asking for donations does not count as
commercial usage**, so a donation link would not by itself require Pro.
Advertising or any paid service would.

## Outstanding actions

1. Write to HII (สสน.) requesting written confirmation of permitted use and
   preferred attribution wording for the ThaiWater endpoints.
2. Write to NECTEC / BMA requesting the same for the Traffy Fondue public data
   endpoint, and ask whether a documented read API is preferred.
3. Review PDPA obligations with someone qualified before any wider release.
