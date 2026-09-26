# SPEC.md — NamWatch · เฝ้าน้ำ

> Working name. Rename freely; update `app.config.ts` and the i18n `app.name` keys only.

**Status:** Draft v0.1 · 26 Sep 2026
**Owner:** Rizwanul Islam Rudra
**Deploy target:** Vercel (`*.vercel.app`, no custom domain yet)
**Scope:** Bangkok first. The data model is multi-city from day one: other provinces are added by configuration, not code.

---

## 1. Why now

Late September 2026, Bangkok is under active flood conditions:

- DDPM warned Bangkok and 70 provinces of flash floods and waterlogging for 23–27 Sep 2026.
- BMA prepared a flood-disaster declaration covering all 50 districts on 26 Sep. Eastern canal-side communities (Khlong Sam Wa, Nong Chok, Lat Krabang, Min Buri and neighbours) are the main concern. The Chao Phraya corridor is being watched but is not the primary risk.
- DDPM sent a Cell Broadcast to phones across Bangkok on the morning of 26 Sep warning of critical canal levels.
- BMA's flood centre publishes lists of roads to avoid and roads small cars should not enter.
- GISTDA satellite analysis marks high-risk areas across central Thailand, including Pathum Thani, Nonthaburi and parts of Bangkok.

Sources: nationthailand.com (25–26 Sep 2026), thestar.com.my (23 Sep 2026), khaosodenglish.com (25 Sep 2026).

**The gap:** official data is spread across 5+ sites and apps, is mostly Thai-only, and doesn't answer the question people actually ask: *"Can I get through this road right now, and is my area getting worse?"*

## 2. Positioning

**Complement, don't compete.**

- **Traffy Fondue** (BMA × NECTEC) is the official channel for asking the city to *act*. We are a *situational-awareness* layer. Every report screen offers "Also send to Traffy Fondue" so people reach the official queue too.
- **We are not a rescue dispatcher.** The emergency hotline bar is always visible (see §8). "Need help" reports are shown to volunteers but never replace 1669 / 1784 / 191 / 1555.
- **Official data and crowd data are visually distinct.** Every datum shows its source and its age.

## 3. Goals and non-goals

### Goals (MVP)
1. One map combining official sensors and crowd reports, bilingual TH/EN.
2. Submitting a flood report takes under 30 seconds, needs no signup, and works on a weak 3G connection.
3. Reports go stale automatically, and the crowd can confirm or retract them ("still flooded" / "water receded").
4. District-level (เขต) summaries that people can share on LINE.
5. Stays within free tiers at small-to-medium traffic.

### Non-goals (MVP)
- Rescue dispatch or case management.
- Flood forecasting models (we display others' forecasts and do not build our own).
- Native apps. The PWA is enough.
- User accounts for the public.

## 4. Users

| Persona | Need | Key screen |
|---|---|---|
| Commuter (TH, mobile, in a hurry) | Is my route passable by motorbike or car? | Map + route-area list |
| Canal-side resident | Is the canal near me rising? Should I move belongings up? | Station detail, district page |
| Expat / tourist (EN) | Plain-English situation and what to do | District page, Help |
| Volunteer / community lead | Where are "need help" reports? | Filtered map (Phase 2: volunteer view) |
| Moderator (you, later a few trusted people) | Remove spam or abuse fast | `/admin` queue |

## 5. Data sources

Every source gets an adapter in `src/lib/sources/<id>/` that normalises its data into the common schema (§7) and reports its own health. **Before writing any adapter, capture real sample payloads into `fixtures/` and document the contract in `docs/sources/<id>.md`.** Endpoint details below were gathered from public references and must be verified. Treat anything marked (verify) as unconfirmed.

| ID | Source | What we get | Access | Cadence | Priority |
|---|---|---|---|---|---|
| `thaiwater` | National Hydroinformatics Data Center (HII / สสน.) — thaiwater.net | Canal and river water levels, bank level, 1h/24h rainfall, station metadata | Public JSON used by the thaiwater.net frontend (`api-v3.thaiwater.net`, e.g. waterlevel and rain_24h loads) (verify). A formal API standard is documented at standard.thaiwater.net | 10–60 min | P0 |
| `bma-dds` | BMA Department of Drainage & Sewerage — weather.bangkok.go.th/flood | Road-flood sensors (cm), BMA rain gauges | **No official API.** Community projects read data embedded in the page. Fragile. Scrape politely (identify the user-agent, cache ≥5 min) and request official access via data.bangkok.go.th / DDS | 5–15 min | P0 |
| `traffy` | Traffy Fondue public API | Citizen complaints tagged flood (ท่วม), with status and agency | Public share API (verify endpoint and terms) | 5–10 min | P0 |
| `rainviewer` | RainViewer | Rain radar tiles (past ~1h, animated) | Public, no key | Tiles | P1 |
| `gistda` | GISTDA disaster portal | Satellite-derived flood extent polygons | Investigate available API or WMS | Daily | P2 |
| `itic` | Longdo Traffic / iTIC | Flooded-road events, cameras | Check licence and key requirements first | Real-time | P2 |
| `openmeteo` | Open-Meteo Flood API (GloFAS) | Coarse river discharge forecasts for non-Bangkok provinces | Free, no key | Daily | P2 |
| `crowd` | Our own users | Reports (§6) | — | Real-time | P0 |

**Rules for all sources**
- Show attribution on the map and the About page, in Thai agency names and English.
- Never re-label official data as ours. Never present crowd data as official.
- Each adapter exposes `health(): { ok, lastSuccessAt, lastError }`, and the UI shows a "source delayed" badge when a source is stale (older than 3× its cadence).
- An adapter failure must never break the map. Degrade layer by layer.

## 6. Crowd reporting

### 6.1 Report form (≤ 30 s, three taps plus optional extras)

1. **Location.** GPS with a "drag pin to adjust" step. Fallback: search by place or district.
2. **Water depth.** Pick one band using body and vehicle pictograms (not numbers alone):

| Band | Token | TH label | EN label | Approx. depth | Passable by |
|---|---|---|---|---|---|
| 0 | `depth-0` | แห้ง / น้ำลดแล้ว | Dry / receded | 0 | All |
| 1 | `depth-1` | ท่วมขังเล็กน้อย (ต่ำกว่าตาตุ่ม) | Puddles (below ankle) | < 10 cm | All, slowly |
| 2 | `depth-2` | ระดับหน้าแข้ง | Shin-deep | 10–30 cm | Cars and pickups. Motorbikes risky |
| 3 | `depth-3` | ระดับเข่า | Knee-deep | 30–50 cm | Pickups and high vehicles only. รถเล็กไม่ควรผ่าน |
| 4 | `depth-4` | ระดับเอว | Waist-deep | 50–100 cm | Not passable. Danger |
| 5 | `depth-5` | สูงกว่าเอว / ระดับอก | Chest-deep or higher | > 100 cm | Life-threatening |

3. **What kind.** `road` ถนน · `home` บ้าน/ชุมชน · `canal` คลองล้นตลิ่ง · `help` ต้องการความช่วยเหลือ
4. *Optional:* one photo (compressed client-side to WebP ≤ 300 KB, EXIF stripped), a note of up to 280 characters, and "passable by" override chips (🏍 / 🚗 / 🛻 / 🚫).

Submit. The report goes into the offline outbox first and syncs when online. Confirmation screen: "Also send to Traffy Fondue?" (deep link / LINE @Traffyfondue) and the hotline list.

### 6.2 Trust and freshness

- **Decay.** At 100% opacity for 1 h, fading to 40% by 6 h, hidden at 12 h unless reconfirmed. `help` reports hide at 24 h.
- **Crowd votes.** Anyone nearby can tap "Still flooded" (ยังท่วมอยู่) or "Water receded" (น้ำลดแล้ว). A vote extends or ends the report's life. One vote per device per report.
- **Corroboration badge.** "Near an official sensor showing flooding" when a BMA or ThaiWater station within 500 m agrees.
- **Flags.** Three distinct device flags auto-hide a report pending review.
- **Anti-abuse.** Cloudflare Turnstile (free) on submit. Rate limit of 5 reports per 10 min per device hash and per IP hash. Profanity and link filter on notes. No URLs allowed in notes.

### 6.3 Privacy

- No accounts. The device ID is a random UUID stored in a signed httpOnly cookie. The server stores only `sha256(deviceId + SERVER_SALT)`. IPs are stored hashed and kept for 7 days for rate limiting only.
- Public coordinates for `home` and `help` reports are **snapped to H3 resolution 9** (~170 m cells) so homes are not pinpointed. `road` and `canal` keep exact coordinates. The exact point is stored server-side only.
- Photos: EXIF stripped client-side *and* re-encoded server-side. Upload guidelines ask people not to photograph faces or licence plates. Moderators remove photos that do.
- Complies with Thailand's PDPA. The privacy notice is in TH and EN. Analytics load only after consent (§12).

## 7. Architecture

```
Browser (PWA, Next.js)
   │  only ever talks to *.vercel.app  ← no direct supabase.co calls from the client
   ▼
Vercel Functions (region sin1, Node.js runtime)
   ├─ /api/v1/*        public read/write API (zod-validated)
   ├─ /api/internal/*  ingest, maintenance (secret-protected)
   └─ source adapters → normalise → Postgres
   │
   ▼
Supabase (Singapore, ap-southeast-1), Free tier
   ├─ Postgres + PostGIS (+ h3 if available, else app-side h3-js)
   └─ Storage bucket `report-photos` (private; served via /api/v1/photos/:id)

Scheduler: GitHub Actions cron (every 10 min) → POST /api/internal/ingest
Fallback: lazy refresh when a read finds data older than 15 min (with an advisory lock)
```

### 7.1 Why this backend choice

**Supabase, accessed only from the server, through a thin data layer (Drizzle + plain Postgres).**

- Postgres + PostGIS, object storage, and a Singapore region in one free tier. Neon has no built-in file storage, so a second vendor would be needed for photos.
- **Server-only access** removes the two real Supabase risks:
  1. *App misconfiguration leaks* (RLS off, exposed keys). The browser never gets a Supabase key, and RLS is still enabled with deny-all as defence in depth.
  2. *ISP or regional blocks of `*.supabase.co`*, which have happened in other countries. Thai users only ever hit `*.vercel.app`, and Vercel → Supabase is server-to-server.
- **Free-tier inactivity pause (7 days).** The 10-minute ingest cron keeps the project active.
- **Portability.** Drizzle schema + SQL migrations + `DATABASE_URL`. Moving to Neon or any Postgres is a connection-string swap plus moving photos to Vercel Blob or Cloudflare R2.
- Connect via the Supavisor **transaction pooler** (port 6543) with `prepare: false` in `postgres.js`.

### 7.2 No Supabase Realtime in MVP

Live updates use SWR polling (map 60 s, district page 120 s) against CDN-cached GET endpoints (`s-maxage=30, stale-while-revalidate=300`). This is cheaper and more robust on bad networks, and it keeps the browser off `supabase.co`. Revisit in Phase 3.

## 8. UX

### 8.1 Principles (disaster UX)
- **Glanceable in rain and sun.** High contrast (WCAG 2.2 AA minimum; AAA for severity labels). Touch targets ≥ 48 px. Works one-handed; primary actions sit in the bottom thumb zone.
- **Calm, not alarmist.** Severity is conveyed by the scale, not by a red UI everywhere.
- **Never colour alone.** Every depth band has colour + pictogram + text label.
- **Freshness is first-class.** Every datum shows its relative age ("12 นาทีที่แล้ว" / "12 min ago") and source.
- **Low-end phone path.** A List view (no WebGL) is a peer of the Map view, not a fallback hidden in settings.
- **Offline tolerant.** Last-known data is cached. Reports queue offline and sync later, with a visible outbox status.

### 8.2 Persistent emergency bar
Collapsed chip at the top of every page that expands to tap-to-call links:

| Number | TH | EN |
|---|---|---|
| 1669 | เจ็บป่วยฉุกเฉิน | Medical emergency |
| 1784 | สายด่วนนิรภัย ปภ. | DDPM disaster hotline |
| 191 | เหตุด่วนเหตุร้าย (ตำรวจ) | Police |
| 1555 | สายด่วน กทม. | BMA hotline |

Hotline numbers live in `src/config/hotlines.ts`, per region, and are reviewed before each release.

### 8.3 Screens (MVP)
1. **Map** `/[locale]`. Layers: crowd reports (clustered), BMA road sensors, ThaiWater stations, rain radar (P1). Filter chips: depth ≥, type, "last 1h / 3h / 12h". Map/List toggle. Floating "แจ้งน้ำท่วม / Report flood" button.
2. **Report** `/[locale]/report`. §6.1 as a single scrolling form, not a wizard. Progress persists if the app is killed.
3. **Report detail** (bottom sheet). Depth, age, photo, votes, corroboration, "Share to LINE", flag.
4. **Station detail** (bottom sheet). Current level vs bank level, a 24h sparkline, trend arrow, source.
5. **District** `/[locale]/area/[slug]`. Summary: worst reported depth, active reports, sensors, rain 24h, official notices link. It has its own OG image for LINE sharing.
6. **Help & safety** `/[locale]/help`. Hotlines, electrocution and floodwater safety, how to report to Traffy Fondue, shelters (link to official lists; we don't maintain our own).
7. **About / sources / privacy** `/[locale]/about`.
8. **Admin** `/admin` (EN only). Moderation queue, source health, hide/restore, ban device hash.

### 8.4 Map
- MapLibre GL JS with **OpenFreeMap** vector tiles (free, no key). Labels switch by locale using the OSM `name:th` / `name:en` properties.
- Clustering uses supercluster on the client for fewer than 5k points. Above that, switch to server-side H3 aggregation (`/api/v1/aggregate?res=7`).
- Default view: Bangkok bbox. Remember the last viewport in localStorage.

## 9. Language (TH / EN)

- Routing: `/th/...` and `/en/...` via `next-intl`. Default is `th`. First visit uses `Accept-Language`, and the chosen locale is stored in a cookie. The language switch is always visible in the header and shows "ไทย | EN", not flags.
- Every translation key exists in both `th.json` and `en.json`, enforced in CI. Thai copy is **written, not machine-translated**; ideally a native Thai reviewer checks every PR that changes `th.json`.
- **Thai typography**
  - Use a Thai-capable UI font. Recommended: *IBM Plex Sans Thai*, *Noto Sans Thai*, or *Anuphan*, paired with a Latin face of similar x-height. Hallmark may choose display type, but body text must render Thai properly.
  - Line-height ≥ 1.6 for Thai body text, because stacked vowels and tone marks clip at tight leading. Never apply letter-spacing to Thai.
  - Set `lang="th"` and `lang="en"` correctly on `<html>` and on mixed-language spans so browsers use Thai dictionary line-breaking. For JS truncation, use `Intl.Segmenter('th', { granularity: 'word' })`; never slice strings by character count.
- **Numbers and dates:** Arabic numerals. Times in `Asia/Bangkok`. Relative time via `Intl.RelativeTimeFormat`. Absolute dates in Thai use the Buddhist Era (th-TH default), e.g. "26 ก.ย. 2569". In English, "26 Sep 2026".
- **Tone:** gender-neutral Thai. No ครับ/ค่ะ in UI chrome; use short imperative verbs ("แจ้งน้ำท่วม", "ยืนยัน", "แชร์"). English uses plain language at roughly grade 6 reading level.
- **Glossary** (keep consistent; lives in `docs/glossary.md`):

| TH | EN |
|---|---|
| น้ำท่วมขัง | Waterlogging / standing water |
| น้ำล้นตลิ่ง | Overbank flooding |
| ระดับน้ำ / ระดับตลิ่ง | Water level / bank level |
| คลอง | Canal (khlong) |
| เขต / แขวง | District (khet) / Subdistrict (khwaeng) |
| จังหวัด / อำเภอ / ตำบล | Province / District (amphoe) / Subdistrict (tambon) |
| รถเล็กไม่ควรผ่าน | Not passable for small cars |
| ประกาศเขตพื้นที่ประสบสาธารณภัย | Disaster area declaration |
| น้ำลดแล้ว / ยังท่วมอยู่ | Water receded / Still flooded |

## 10. Design system — Hallmark

- Install the Hallmark skill (github.com/Nutlope/hallmark), then run its default build flow for the first screen (Map + report button + emergency bar) with the brief in `docs/design-brief.md`.
- After the first screen is approved: **"lock the system"** → Hallmark writes `DESIGN.md` at the repo root. From then on, `DESIGN.md` is the single source of truth, and every new screen must share it.
- **Non-negotiables that override any Hallmark theme** (put them in the brief):
  1. The depth-band colours `depth-0…5` are **semantic tokens defined by this spec** (colour-blind-safe sequential scale, validated with a CVD simulator), not theme colours.
  2. Thai-capable body font and Thai line-height rules (§9).
  3. Contrast and touch-target minimums (§8.1).
  4. The emergency bar and source/freshness labels cannot be restyled into invisibility.
  5. Dark mode is supported. Many people check at night during outages to save battery.
- Suggested direction for the brief: civic utility, calm, trustworthy, information-dense but not cluttered. Avoid "startup landing page" aesthetics.
- Run `hallmark audit` on changed UI before merging.

## 11. Data model (Postgres + PostGIS)

```sql
-- regions: province → district → subdistrict, multi-city ready
regions (
  id text primary key,              -- e.g. 'th-10' (BKK), 'th-10-khlong-sam-wa'
  level text check (level in ('province','district','subdistrict')),
  parent_id text references regions(id),
  name_th text not null, name_en text not null,
  slug text unique not null,
  geom geometry(MultiPolygon, 4326),
  enabled boolean default false
);

stations (
  id uuid primary key default gen_random_uuid(),
  source text not null,             -- 'thaiwater' | 'bma-dds' | ...
  external_id text not null,
  kind text not null,               -- 'canal_level' | 'river_level' | 'road_flood' | 'rain'
  name_th text, name_en text,
  geom geography(Point) not null,
  region_id text references regions(id),
  bank_level_m numeric, ground_level_m numeric,
  meta jsonb default '{}',
  unique (source, external_id)
);

station_readings (
  station_id uuid references stations(id) on delete cascade,
  observed_at timestamptz not null,
  value numeric not null,           -- metres, cm, or mm per kind (documented in docs/sources)
  status text,                      -- normalised: 'normal'|'watch'|'warning'|'critical'|'unknown'
  primary key (station_id, observed_at)
);

reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  kind text check (kind in ('road','home','canal','help')),
  depth_band smallint check (depth_band between 0 and 5),
  passable_by text[],               -- 'motorbike','car','pickup','none'
  note text check (char_length(note) <= 280),
  locale text check (locale in ('th','en')),
  geom_exact geography(Point) not null,   -- server-only
  geom_public geography(Point) not null,  -- snapped for home/help
  h3_r9 text not null,
  region_id text references regions(id),
  photo_key text,
  device_hash text not null,
  ip_hash text,
  still_count int default 0, receded_count int default 0, flag_count int default 0,
  status text default 'active' check (status in ('active','hidden','removed','expired')),
  expires_at timestamptz not null
);

report_votes (
  report_id uuid references reports(id) on delete cascade,
  device_hash text not null,
  vote text check (vote in ('still','receded','flag')),
  created_at timestamptz default now(),
  primary key (report_id, device_hash, vote)
);

source_health (source text primary key, last_success_at timestamptz, last_error text, updated_at timestamptz);
rate_limits (key text, window_start timestamptz, count int, primary key (key, window_start));
moderation_log (id bigserial primary key, report_id uuid, action text, actor text, reason text, at timestamptz default now());
```

Indexes: GIST on every `geom*`, B-tree on `reports(status, expires_at)`, `reports(h3_r9)`, and `station_readings(observed_at)`.

**Retention (to stay under the 500 MB free-tier DB):** keep raw readings for 14 days, then roll up to hourly (`station_readings_hourly`). Expired reports older than 90 days are deleted along with their photos. A nightly maintenance job does both.

## 12. API (v1)

All responses are JSON and validated with zod. Errors use `{ error: { code, message_th, message_en } }`.

| Method | Path | Notes | Cache |
|---|---|---|---|
| GET | `/api/v1/map?bbox=&layers=&since=` | Combined GeoJSON for the viewport | `s-maxage=30, swr=300` |
| GET | `/api/v1/reports/:id` | Public fields only | `s-maxage=15` |
| POST | `/api/v1/reports` | multipart (fields + optional photo ≤ 1 MB). Requires Turnstile token | none |
| POST | `/api/v1/reports/:id/vote` | `{ vote }` | none |
| GET | `/api/v1/stations/:id?hours=24` | Metadata + series | `s-maxage=120` |
| GET | `/api/v1/regions/:slug/summary` | District page data | `s-maxage=60` |
| GET | `/api/v1/photos/:key` | Proxied from Storage, resized | `s-maxage=86400, immutable` |
| GET | `/api/v1/health` | Source health + DB ping | `no-store` |
| POST | `/api/internal/ingest` | Header `x-ingest-secret`. Runs all due adapters | none |
| POST | `/api/internal/maintain` | Expiry, roll-ups, retention | none |

Photo upload goes **through** the Vercel function (not a signed Supabase URL), so the client never contacts `supabase.co`. Keep uploads under Vercel's request body limit by compressing on the client.

## 13. Analytics

- Google Analytics 4 with **Consent Mode v2, default denied**. The GA script loads only after "Accept" in a TH/EN consent banner (PDPA).
- Key events: `report_started`, `report_submitted`, `report_queued_offline`, `vote_cast`, `share_line`, `hotline_tap`, `locale_switch`, `layer_toggle`.
- Never send coordinates, notes, or device IDs to GA. Districts are fine.
- Optional: Vercel Web Analytics (cookieless) as a consent-free baseline.

## 14. Non-functional requirements

| Area | Target |
|---|---|
| Performance | LCP < 2.5 s on a mid-range Android over 4G. Initial JS < 170 KB gz excluding the lazy-loaded map chunk. List view usable without WebGL |
| Availability | Map renders with at least one layer even if the DB is down (last-good snapshot cached in the SW + CDN) |
| Accessibility | WCAG 2.2 AA. Screen-reader labels in both languages. Map has a list equivalent |
| Security | No secrets in the client. Turnstile + rate limits. CSP headers. RLS enabled deny-all. Service key server-only |
| Observability | Structured logs (`pino`) with source/adapter tags. `/api/v1/health`. Vercel log drains later |
| Cost | $0/month at MVP scale (§15) |

## 15. Cost plan

| Service | Free tier used for | Upgrade trigger | Next step |
|---|---|---|---|
| Vercel Hobby | Hosting, functions, CDN | Any **commercial** use (Hobby is non-commercial), or bandwidth/function limits | Vercel Pro |
| Supabase Free | Postgres + PostGIS, 1 GB photos | DB > ~400 MB, need backups/PITR, or egress limits | Supabase Pro ($25/mo) |
| GitHub Actions | 10-min ingest cron | — | Supabase `pg_cron` + `pg_net`, or Vercel Pro cron |
| Cloudflare Turnstile | Bot protection | — | — |
| OpenFreeMap / RainViewer | Map tiles, radar | Heavy traffic or ToS limits | Self-host Protomaps PMTiles on R2 |
| Cloudflare R2 (later) | Photos beyond 1 GB | Storage > 800 MB | Move bucket; `photo_key` is vendor-neutral |

**On monetisation:** paywalling safety information during a disaster would hurt both trust and adoption. Better options are sponsorship, grants (civic-tech / climate funds), a paid API or data export for businesses and insurers, or white-label deployments for provinces.

## 16. Roadmap

### Phase 0 — Ship this weekend (48–72 h)
- [ ] Next.js scaffold, i18n (th/en), deploy to Vercel
- [ ] Hallmark first-screen build → lock `DESIGN.md`
- [ ] Emergency bar, Help page
- [ ] `thaiwater` + `traffy` adapters with fixtures, ingest via GitHub Actions
- [ ] Map + List view with official layers
- [ ] Report form (no photo), votes, decay, Turnstile, rate limit
- [ ] About/sources/privacy pages, GA consent

### Phase 1 — Week 1–2
- [ ] `bma-dds` adapter (plus a request for official access)
- [ ] Photos (compress, strip EXIF, proxy)
- [ ] PWA: offline outbox, last-known data cache
- [ ] District pages + LINE share + OG images
- [ ] Admin moderation queue
- [ ] RainViewer radar layer

### Phase 2 — Month 1–2
- [ ] Web Push alerts per saved area (district + depth threshold)
- [ ] Enable surrounding provinces (Nonthaburi, Pathum Thani, Samut Prakan) via `regions.enabled`
- [ ] GISTDA flood extents, Open-Meteo for non-BKK
- [ ] Optional LINE Login for trusted volunteers and a volunteer "help" view
- [ ] LINE Official Account broadcast (watch free message quotas)

### Phase 3 — If it grows
- [ ] Nationwide regions, server-side H3 aggregation
- [ ] Public read API for partners
- [ ] Evaluate Realtime, paid tiers, R2 migration

## 17. Success metrics
- Median report submission time < 30 s.
- ≥ 30% of reports receive at least one vote within 2 h.
- Share of map sessions that open a detail or district page.
- Source freshness: official layers < 20 min stale 95% of the time.
- Spam: < 2% of reports removed by moderation.

## 18. Open questions
1. Exact ThaiWater and Traffy endpoints, rate limits, and terms. Contact HII and NECTEC for permission and attribution wording.
2. BMA DDS: can we get an official feed instead of parsing the page?
3. District boundary GeoJSON source and licence (BMA open data portal vs OSM).
4. Who are the Thai-language reviewers and moderators during the emergency?
5. Name and brand. Check that it isn't confused with official BMA or DDPM services.
