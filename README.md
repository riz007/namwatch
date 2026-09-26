# NamWatch · เฝ้าน้ำ

A bilingual (Thai / English) flood situational-awareness map for Bangkok.

It combines official water-level sensors with citizen reports filed through the
city's own channel, and shows them on one map — each with its source and how old
it is. Built for people checking on a phone, on a weak connection, during a
flood.

> NamWatch is a volunteer project. It is **not** a BMA or DDPM service, and it is
> **not** a rescue dispatcher. Emergency numbers are on every page.

## What it does

- **One map, three kinds of data.** Government gauging stations, complaints filed
  through Traffy Fondue, and community reports — drawn as three different shapes
  so they can never be mistaken for each other, each labelled with its source and
  age.
- **A list view that is a peer of the map**, not a fallback. It carries the same
  information without WebGL, because that is what a cheap phone actually renders.
- **A depth scale that never relies on colour.** Six bands, each with a colour, a
  pictogram and a text label. The palette is validated against simulated
  protanopia, deuteranopia and tritanopia by `pnpm check:cvd`, which runs in CI.
- **Reports that expire.** A report fades and disappears on its own unless
  someone nearby confirms the water is still there.

## Stack

Next.js · TypeScript · Tailwind · next-intl · MapLibre GL + OpenFreeMap ·
Drizzle + Postgres/PostGIS · Vitest · Playwright

## Running it

```bash
pnpm install
cp .env.example .env.local   # fill in the values
pnpm db:migrate              # requires DATABASE_URL_DIRECT
pnpm dev
```

Without a database, `pnpm ingest:local` runs every source adapter against
committed fixtures and prints what each one produced — no network, no database.

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm i18n:check && pnpm check:cvd
```

| Command | What it guards |
|---|---|
| `pnpm i18n:check` | Thai and English message files cannot drift apart |
| `pnpm check:cvd` | The depth palette stays distinguishable under colour-vision deficiency |
| `pnpm check:bundle` | Initial JS budget, and that the map chunk stays lazy |
| `pnpm test` | Source adapters run against committed fixtures, never the network |

## Data sources and attribution

- Water levels and rainfall — สถาบันสารสนเทศทรัพยากรน้ำ (HII / สสน.)
- Citizen reports — Traffy Fondue (กรุงเทพมหานคร × เนคเทค)
- Base map — OpenFreeMap © OpenMapTiles, data from OpenStreetMap

See [docs/licensing.md](docs/licensing.md) for what has and has not been
established about the right to use each source. Two of the three publish no
terms at all; that is documented rather than glossed over.

## Privacy

No accounts, no names, no phone numbers. Home and "need help" reports are
blurred to an approximate area before they are published, and their exact
coordinates never leave the server. Device and IP identifiers are stored only as
salted hashes, used only for rate limiting, and deleted within seven days.

## Licence

MIT for the code. Upstream data remains under its own terms — see
[docs/licensing.md](docs/licensing.md).
