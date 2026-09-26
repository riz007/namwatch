# AGENTS.md

Instructions for any AI coding agent (Claude Code, Codex, Cursor, Copilot…) working in this repo.
Product requirements live in **SPEC.md**. Visual rules live in **DESIGN.md**, which the Hallmark skill generates. When they conflict: SPEC.md safety/UX non-negotiables > DESIGN.md > everything else.

## Project in one paragraph
NamWatch (เฝ้าน้ำ) is a bilingual (Thai/English) flood situational-awareness web app for Bangkok, designed to expand to other Thai provinces. It combines official sensor data (ThaiWater/HII, BMA DDS, Traffy Fondue) with anonymous crowd reports on one map. People use it **during an active disaster**, often on weak connections and cheap phones. Correctness, clarity, and speed matter more than cleverness.

## Stack
- Next.js (latest stable, App Router, React Server Components), TypeScript `strict`
- Tailwind CSS v4, with tokens from DESIGN.md (Hallmark exports `@theme`)
- `next-intl` for `th` / `en` routing and messages
- MapLibre GL JS + OpenFreeMap tiles; `supercluster`; `h3-js`
- SWR for client polling
- Drizzle ORM + `postgres` (postgres.js) → Supabase Postgres + PostGIS (server only)
- Supabase Storage for photos (server only, accessed with the service key)
- zod at every boundary; pino for logs
- Cloudflare Turnstile; GA4 with Consent Mode v2
- Vitest (unit), Playwright (e2e, mobile viewport), pnpm
- Deploy: Vercel, functions pinned to region `sin1`

## Commands
```bash
pnpm install
pnpm dev                 # local dev
pnpm typecheck           # tsc --noEmit
pnpm lint                # eslint
pnpm test                # vitest
pnpm test:e2e            # playwright (mobile + desktop projects)
pnpm i18n:check          # fails if th.json / en.json keys differ or values are empty
pnpm db:generate         # drizzle-kit generate (creates SQL migration)
pnpm db:migrate          # apply migrations to DATABASE_URL
pnpm ingest:local        # run all adapters once against fixtures (no network)
```
Before declaring any task done: `pnpm typecheck && pnpm lint && pnpm test && pnpm i18n:check`.

## Layout
```
app/
  [locale]/              # th | en
    page.tsx             # map + list
    report/              # report form
    area/[slug]/         # district summary
    help/  about/
  admin/                 # moderation (EN only, auth-gated)
  api/v1/                # public API (see SPEC §12)
  api/internal/          # ingest, maintain (secret header)
src/
  config/                # hotlines.ts, regions.ts, depth-bands.ts, app.config.ts
  lib/sources/<id>/      # adapter.ts, schema.ts, normalize.ts, fixtures/*.json, adapter.test.ts
  lib/db/                # drizzle schema, queries (the only place SQL lives)
  lib/geo/               # bbox, h3 snapping, region lookup
  lib/reports/           # decay, trust, rate-limit logic (pure functions, fully tested)
  components/            # UI, following DESIGN.md
  i18n/messages/         # th.json, en.json
docs/
  sources/<id>.md        # verified contract for each upstream source
  glossary.md            # TH/EN terminology
  design-brief.md        # brief given to Hallmark
supabase/migrations/     # generated SQL; never edit applied migrations
.github/workflows/       # ci.yml, ingest.yml (cron every 10 min)
```

## Hard rules

### Safety and trust (never break these)
1. The **emergency hotline bar** renders on every public page, in both languages. Numbers come only from `src/config/hotlines.ts`.
2. **Official data vs crowd data** must always look different and always show **source + relative age**. Never label crowd reports as verified or official.
3. Never add features that imply we dispatch rescue. "Need help" copy always points to hotlines.
4. Depth bands, labels, and colours come only from `src/config/depth-bands.ts` and the `depth-*` tokens. Don't invent new severity levels or colours.
5. A failing source adapter must degrade only its own layer. Never throw into page render.

### Architecture
6. **The browser never talks to Supabase.** Don't import `@supabase/supabase-js` or any DB client in client components. All data flows through `app/api/*` or server components. This is deliberate (security + ISP-block resilience). See SPEC §7.1.
7. DB access only via `src/lib/db/`. Use the transaction pooler URL with `prepare: false`.
8. Validate every request body, query string, and upstream payload with zod. Upstream schemas live next to the adapter.
9. Public GET routes set `Cache-Control` per SPEC §12. Mutations are never cached.
10. Exact coordinates of `home` / `help` reports never leave the server. Public responses use `geom_public`.
11. Keep the free tier alive: no chatty polling (min 30 s), no N+1 queries, no unbounded selects (always a bbox or limit).

### Data sources
12. **Before writing or changing an adapter**, fetch a real sample, save it to `fixtures/`, and update `docs/sources/<id>.md` (URL, params, fields, units, cadence, terms, attribution). Tests run against fixtures only; CI never hits upstream.
13. Scrapers (e.g. `bma-dds`) must: identify the user-agent (`NamWatch/0.x (+repo URL)`), cache ≥ 5 min, back off on errors, and parse defensively. Expect markup to change.
14. Normalise units in adapters: water levels in metres (MSL), road flood in cm, rain in mm. Document the unit in the column comment.

### i18n
15. No hard-coded user-facing strings. Every key goes into **both** `th.json` and `en.json` in the same commit.
16. Write Thai as a native speaker would. No literal translation, no ครับ/ค่ะ in UI chrome. Follow `docs/glossary.md`. If unsure of Thai wording, add a `// TODO(th-review)` comment in the PR description, not in the JSON.
17. Correct `lang` attributes. Never truncate Thai by character count (use `Intl.Segmenter`). No `letter-spacing` on Thai text. Thai body line-height ≥ 1.6.
18. Times in `Asia/Bangkok`. Relative time for freshness. Thai absolute dates use the Buddhist Era (th-TH default).

### UI and design
19. **DESIGN.md is law** once it exists. Don't introduce new colours, fonts, radii, or spacing outside its tokens. If a need isn't covered, propose a token change in the PR.
20. Use the Hallmark skill for new screens/components; run `hallmark audit` on changed UI.
21. Mobile-first at 360 px width. Touch targets ≥ 48 px. Primary actions in the bottom thumb zone.
22. WCAG 2.2 AA. Never convey severity by colour alone (colour + icon + text). The map always has a List equivalent.
23. Dark mode supported through tokens, not ad-hoc overrides.
24. Performance budget: initial JS < 170 KB gz; the map bundle is lazy-loaded. Don't add dependencies over 30 KB gz without justification.

### Privacy and analytics
25. GA loads only after consent. Never send coordinates, notes, photo keys, or device IDs to analytics.
26. Strip EXIF on the client and re-encode on the server. Photos are served only through `/api/v1/photos/:key`.
27. Store only hashes of device IDs and IPs (`sha256(value + SERVER_SALT)`).

### Security
28. Secrets only in Vercel env vars / `.env.local` (git-ignored). The service role key is server-only. RLS is enabled on all tables (deny-all; the app uses the server connection).
29. `/api/internal/*` requires `x-ingest-secret` and constant-time comparison.
30. Never commit real user data, photos, or production dumps. Fixtures must be upstream public data or synthetic.

## Environment variables
```
DATABASE_URL=                 # Supabase transaction pooler (6543)
DATABASE_URL_DIRECT=          # direct (5432) for migrations only
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=    # server only
SERVER_SALT=
INGEST_SECRET=
TURNSTILE_SECRET_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
NEXT_PUBLIC_GA_ID=
ADMIN_EMAILS=                 # comma-separated allowlist
```

## Git and PRs
- Small PRs, conventional commits (`feat(report): …`, `fix(thaiwater): …`).
- A PR description includes: what/why, screenshots at 360 px in **both** TH and EN for UI changes, and any `th-review` items.
- Migrations: one per PR, generated by drizzle-kit, never hand-edited after merge.

## Definition of done
- [ ] typecheck, lint, tests, i18n:check pass
- [ ] TH + EN copy present and reviewed for tone
- [ ] Works at 360 px, keyboard-navigable, labelled for screen readers
- [ ] Source + freshness shown for any new data display
- [ ] No client → Supabase calls; no secrets in the client bundle
- [ ] SPEC.md updated if behaviour or scope changed
