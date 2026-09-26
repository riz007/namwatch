# Source: `thaiwater`

National Hydroinformatics Data Center — **สถาบันสารสนเทศทรัพยากรน้ำ (องค์การมหาชน)** / Hydro‑Informatics Institute (Public Organization), "HII" / "สสน.". Public aggregation API behind [thaiwater.net](https://www.thaiwater.net).

HII **aggregates** telemetry owned by other agencies. Per‑reading attribution is carried in `agency` and must be surfaced, not flattened to "ThaiWater".

**Verified against live payloads fetched 2026‑09‑26 05:41–05:48 UTC (12:41–12:48 Asia/Bangkok).** Everything below marked "verified" was checked against those payloads (805 water‑level readings, 4 277 rain readings). Anything not established is in [Unverified / open questions](#unverified--open-questions).

---

## 1. Endpoints

| | Water level | Rain (24 h) |
|---|---|---|
| URL | `https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load` | `https://api-v3.thaiwater.net/api/v1/thaiwater30/public/rain_24h` |
| Method | `GET` | `GET` |
| Query params | none known | none known |
| Auth | none | none |
| Payload size | ~1.4 MB | ~4.5 MB |
| Readings | 805 | 4 277 |
| `content-type` | `application/json; charset=utf-8` | same |

Always send `User-Agent: NamWatch/0.1 (+https://github.com/namwatch/namwatch)` (AGENTS.md rule 13).

**No parameters are known to filter server‑side.** Both endpoints return the whole country; filter to Bangkok metro client‑of‑the‑server side. At 4.5 MB, `rain_24h` is the single largest ingest cost in the app — see Cadence.

### Response headers (verified)

No `cache-control`, no `etag`, no `last-modified`, no rate‑limit headers, no `access-control-allow-origin`. Consequences:

- **Conditional requests are not available.** Every poll transfers the full payload. Cache aggressively on our side.
- The absence of CORS headers is a second reason (on top of AGENTS.md rule 6) that the browser must never call this directly.

`https://www.thaiwater.net/robots.txt` contains only `User-agent: *` and a `Sitemap:` line — no `Disallow`. This covers the website, not the API; see open questions on terms.

---

## 2. `waterlevel_load` — envelope

Top level is an object of seven keys. Each is `{ result: "OK", data: … }`.

| Key | Shape | Notes |
|---|---|---|
| `waterlevel_data` | `{result, data: Reading[]}` | **The telemetry we consume.** 805 items. |
| `waterlevel_manual_data` | `{result, data: ManualReading[]}` | 35 items, **different and smaller schema** — see §2.4. |
| `scale` | `{result, data: {…}}` | Legend + the `situation_level` thresholds. See §2.5. |
| `agency` | `{result, data: Agency[]}` | 11 agencies. Attribution registry. |
| `basin` | `{result, data: Basin[]}` | 24 basins. |
| `province` | `{result, data: Province[]}` | 80 provinces (`id`, `geocode`, `province_code`, `province_name{th,en}`). |
| `station` | `{result, data: {tele_waterlevel: null, canal_waterlevel: null}}` | **Empty in every observed fetch.** Not a usable station registry. Do not depend on it. |

`result` was `"OK"` in all observed responses. Its failure value is unverified.

### 2.1 Reading — top level (`.waterlevel_data.data[]`)

n = 805. "absent" means **the key is missing from the object**, not `null` — this matters for zod (`.optional()` vs `.nullable()`).

| Field | Type | Unit | Nullability (of 805) | Notes |
|---|---|---|---|---|
| `id` | number | — | always present | **Per‑reading surrogate key, NOT a station id.** See §5. |
| `waterlevel_datetime` | string | — | always present | `"YYYY-MM-DD HH:MM"`, **Asia/Bangkok local**, no offset. 805/805 match the format. See §6. |
| `waterlevel_msl` | **string** | **metres above MSL** | 0 null, 0 absent, 0 empty, 0 non‑numeric | Numeric string, 2 dp. Parse with care — it is a string. |
| `waterlevel_msl_previous` | string | metres MSL | 0 null | The prior reading's value. Useful for a rising/falling arrow. |
| `waterlevel_m` | `null` | — | **null in all 805** | Never populated in this endpoint. Treat as unusable. |
| `storage_percent` | string \| null | **percent (0–∞)** | 15 null | Channel‑fill percentage, **not** a reservoir volume. Formula verified in §4. Can exceed 100. |
| `situation_level` | number | 1–5 | **15 absent** (0 explicitly null) | Derived from `storage_percent`. **See §4 — this is the field most likely to be misread.** |
| `flow_rate` | string \| null | unverified (likely m/s) | 799 null | Only 6 non‑null. See open questions. |
| `discharge` | string \| null | unverified (likely m³/s) | 517 null | 288 non‑null, range 0.00–2594.00. See open questions. |
| `diff_wl_bank` | string | **metres, absolute value** | always present | `= |waterlevel_msl − station.min_bank|`, 2 dp. Verified 805/805. **Unsigned** — direction is only in `diff_wl_bank_text`. |
| `diff_wl_bank_text` | string | — | always present | Exactly two values: `"ล้นตลิ่ง (ม.)"` (over bank, 62) / `"ต่ำกว่าตลิ่ง (ม.)"` (below bank, 743). |
| `sort_order` | `null` | — | **null in all 805** | Unusable. |
| `station_type` | string | — | always present | `"tele_waterlevel"` for all 805. |
| `river_gid` | number | — | **79 absent** | |
| `river_name` | string | — | **79 absent** | Thai only, no `{th,en}` object. |
| `station` | object | — | 0 null | See §2.2. |
| `agency` | object | — | 0 null | `{id, agency_name{th,en,jp}, agency_shortname{th,en,jp}}`. |
| `basin` | object | — | 0 null | `{id, basin_code, basin_name{th,en}}`. `basin_name.en` can be `""`. |
| `geocode` | object | — | 0 null | See §2.3. |

`situation_level` distribution: 1→44, 2→169, 3→326, 4→195, 5→56 (15 absent).

### 2.2 `reading.station`

| Field | Type | Unit | Nullability | Notes |
|---|---|---|---|---|
| `id` | number | — | always | **Stable station identifier. Use this.** See §5. |
| `tele_station_oldcode` | string | — | always | Human‑readable code (`CPY015`, `BKK021`, `C.12`). Stable, 1:1 with `id`. |
| `tele_station_name` | object | — | always | `{th: string, en?: string}`. `th` always present. **`en` key absent for 384/805 (47.7 %)** — absent, never null or empty. |
| `tele_station_lat` | number | deg WGS84 | always | No zeros observed. |
| `tele_station_long` | number | deg WGS84 | always | No zeros observed. |
| `tele_station_type` | string | — | always | `"tele_waterlevel"` for all. |
| `min_bank` | number | **metres MSL** | 0 null; **6 are `0`** (degenerate) | Lower of the two banks — the level at which overflow starts. |
| `left_bank` | number | metres MSL | 0 null | |
| `right_bank` | number | metres MSL | 0 null | |
| `ground_level` | number | **metres MSL** | **9 absent**; 35 are `0` | Channel **bed** elevation. Can be strongly negative (e.g. −15.697 m at CPY015). |
| `offset` | number \| null | metres (unverified datum) | 570 null | See open questions. |
| `qmax` | number \| null | unverified | 526 null | See open questions. |
| `warning_level_m` | number \| null | metres | **803 null** | Effectively unusable. |
| `critical_level_m` | number \| null | metres | 770 null | |
| `critical_level_msl` | number \| null | metres MSL | 698 null | 107 non‑null. Not used by `situation_level`. |
| `is_key_station` | boolean | — | always | `true` for 199. Meaning unverified. |
| `sub_basin_id` | number | — | always | |
| `agency_id` | number | — | always | Joins `.agency.data[].id`. |
| `geocode_id` | number | — | always | |
| `hydro_id` | number \| null | — | 491 null | |
| `sponsor_by` | string | — | **708 absent** | Thai free text. |

### 2.3 `reading.geocode`

All eight keys present in all 805 readings:

`area_code` (string), `area_name{th,en}`, `province_code` (string, zero‑padded — `"10"` = Bangkok), `province_name{th,en}`, `amphoe_code` (string), `amphoe_name{th,en}`, `tumbon_code` (string), `tumbon_name{th,en}`.

Codes are **strings**, not numbers — `"10"`, not `10`. Province codes are the standard Thai administrative codes.

### 2.4 `waterlevel_manual_data` — a different schema

35 items. **Do not feed these through the telemetry parser.** Verified differences:

- `waterlevel_msl` is `null` in **all 35**; `waterlevel_m` null in all 35. Only `discharge` is populated (35/35).
- `situation_level` key **absent in all 35**.
- `station` lacks `tele_station_lat`, `tele_station_long`, `min_bank`, `ground_level`, `tele_station_type`, `sub_basin_id` — so these readings **cannot be placed on the map**.
- `geocode` lacks `province_code` (only `province_name`/`amphoe_name`/`tumbon_name`), so province filtering must fall back to name matching.
- `basin` is `null` in all 35.
- `diff_wl_bank` and `diff_wl_bank_text` are `""`.
- `station_type` is `""`.

**Recommendation: ignore `waterlevel_manual_data` in Phase 0.** It carries no mappable water level.

### 2.5 `scale` — the legend and the thresholds

`.scale.data` has keys `scale`, `rule`, `rule_web`, `level`, `not_today`.

`rule_web` is the one that matters — it is the `situation_level` threshold table, applied to `storage_percent`:

| Condition on `storage_percent` | `situation_level` | `scale[].situation` | colour | colourname |
|---|---|---|---|---|
| `> 100` | 5 | น้ำล้นตลิ่ง (water over bank) | `#FF0000` | red |
| `> 70` | 4 | น้ำมาก (high water) | `#003CFA` | blue |
| `> 30` | 3 | น้ำปกติ (normal) | `#00B050` | green |
| `> 10` | 2 | น้ำน้อย (low) | `#FFC000` | yellow |
| `<= 10` | 1 | น้ำน้อยวิกฤติ (critically low) | `#990000` | gold |

`rule` (2‑level variant) and `level` are a separate, coarser mapping (1 = low‑critical, 2 = over bank) apparently for a different UI. `not_today` is the grey "no reading today" style.

> **Do not use ThaiWater's colours.** AGENTS.md rule 4: depth/severity colours come only from `src/config/depth-bands.ts`. This table is documented so we can *map* `situation_level`, not so we can paint with it. Note their level‑4 is blue and level‑1 is dark red — an ordering that would be actively misleading in our UI.

---

## 3. `rain_24h`

Flat envelope: `{ result: "OK", data: RainReading[] }`. **No registries, no `scale` key** — unlike `waterlevel_load`.

| Field | Type | Unit | Nullability (of 4 277) | Notes |
|---|---|---|---|---|
| `id` | number | — | always | Unique per item. See §5 for the caveat. |
| `rainfall_datetime` | string | — | always | `"YYYY-MM-DD HH:MM"`, Asia/Bangkok. |
| `rain_24h` | **number** | **mm over 24 h** | always | Note: a real number here, *not* a string (unlike `waterlevel_msl`). Observed min 0, p50 5, p95 77.4, max 314. |
| `rain_1h` | number | **mm over 1 h** | **2 429 absent** | Only 1 848 have the key. Observed min 0, p50 0, p95 5, max 48. |
| `station_type` | string | — | always | `"rainfall_24h"` for all. |
| `station` | object | — | always | See below. |
| `agency` | object | — | always | `{agency_name{th,en,jp}, agency_shortname{th,en,jp}}` — **no `id`**, unlike water level. |
| `basin` | object | — | always | `{id, basin_code, basin_name{th,en}}`. |
| `geocode` | object | — | always | See below. |

`rain.station`: `id` (number), `tele_station_oldcode` (string), `tele_station_name` (`{th, en?}`), `tele_station_lat`, `tele_station_long`, `tele_station_type`, `sub_basin_id` (**string** here, number in water level), `sponsor_by` (absent for 3 832).

There is **no `min_bank` / `ground_level` / `situation_level` / `storage_percent`** on rain readings — no severity is provided. Any rain banding is ours to define.

`rain.geocode`: `warning_zone`, `area_code`, `area_name`, `province_code`, `province_name`, `amphoe_name`, `tumbon_name`. **Note: `amphoe_code` and `tumbon_code` are absent** (present on water level), and `warning_zone` is present (absent on water level). Meaning of `warning_zone` is unverified.

**Units are mm.** Stated confidence: high but *inferential* — see open questions.

### Bilingual names (rain)

`tele_station_name.en` key is **absent for 2 678 of 4 277 (62.6 %)**, and `""` for 1 more. `th` present for all 4 277.

---

## 4. `situation_level` — RESOLVED

**`situation_level` is a channel‑fill percentage band. It is NOT bank freeboard, and level 4 does not mean "nearly overflowing".**

Verified, exactly, on the live payload:

**(a) `situation_level` = `rule_web` applied to `storage_percent`.**
Tested on all 790 readings that have both fields: **790/790 exact match, 0 mismatches.**

**(b) `storage_percent` = (waterlevel_msl − ground_level) / (min_bank − ground_level) × 100.**
Tested on the same 790: **790/790 agree within 0.5 pp**, 698 within 0.05 pp. The residual is fully explained by `waterlevel_msl` being published rounded to 2 dp — for 781/790 the deviation is within the bound that a ±0.005 m rounding of `waterlevel_msl` implies for that station's channel depth.

So `storage_percent` measures **how full the channel is from bed to lowest bank**, and `situation_level` bands that.

### Why "Chao Phraya 15" is level 4 while 1.7 m below bank

```
CPY015  waterlevel_msl = 0.34   min_bank = 2.16   ground_level = −15.697
channel depth = 2.16 − (−15.697) = 17.857 m
storage_percent = (0.34 + 15.697) / 17.857 × 100 = 89.80   ← matches published 89.80
89.80 > 70  →  situation_level 4                            ← matches published 4
diff_wl_bank = |0.34 − 2.16| = 1.82 m below bank             ← matches published 1.82
```

The Chao Phraya at Krung Thep Bridge has a **very deep dredged channel** (bed ~15.7 m below MSL). A water column filling 90 % of that depth is still 1.82 m short of the bank. Both numbers are correct; they answer different questions.

### Consequences for NamWatch — important

1. **`situation_level` is a poor flood-risk signal for deep channels and must not drive our severity band.** For public-safety display, **`diff_wl_bank` + `diff_wl_bank_text` (metres below/over bank) is the meaningful quantity**, and it maps far more naturally onto `src/config/depth-bands.ts`.
2. `diff_wl_bank` is **unsigned**. Always pair it with `diff_wl_bank_text`, or recompute the sign as `waterlevel_msl − min_bank`.
3. Edge case: when `waterlevel_msl == min_bank` exactly, HII labels it `ล้นตลิ่ง` (over bank). 1 station (SKM001) in the observed payload. So their test is `>=`, ours should match to avoid disagreeing with the official site.
4. The 15 readings with no `situation_level` are exactly the 15 with `storage_percent: null`, and each has a **degenerate channel geometry**: either `ground_level` absent (9) or `min_bank == ground_level == 0` (6). HII omits the derived fields rather than dividing by zero. **Our adapter must do the same — never synthesise a level for these.**

---

## 5. Station identification — VERIFIED

Two water‑level payloads fetched 41 minutes apart (12:00 and 12:41 Asia/Bangkok), 805 readings each:

| Candidate | Result | Verdict |
|---|---|---|
| `station.id` | 805 unique, **set identical across both fetches, 0 changed** | ✅ **Use this as the primary key.** |
| `station.tele_station_oldcode` | 805 unique, **set identical, 0 changed**, 1:1 with `station.id` | ✅ Stable. Good as a human‑readable secondary key. |
| top‑level `id` | 805 unique per fetch, but **only 330 in common — 475 changed** | ❌ **Per‑reading id. Never use as a station key.** |

Decisive: **the top‑level `id` changed for exactly the 475 stations whose `waterlevel_datetime` also changed, and was unchanged for exactly the 330 whose `waterlevel_datetime` was unchanged** (475/475 and 330/330, no exceptions). It is a surrogate key for the *observation row*, incrementing as new telemetry lands.

**Recommended strategy**

- Natural key: `('thaiwater', station.id)`. Unique index on that.
- Store `tele_station_oldcode` as a stable human label and for cross‑referencing HII/RID publications.
- Use the top‑level `id` **only** for reading‑level dedupe — or better, dedupe on `(station.id, waterlevel_datetime)`, which is more robust and does not depend on HII's surrogate.
- No station appeared or disappeared between fetches, but the adapter must still tolerate both.

**Rain:** `station.id`, `tele_station_oldcode` and top‑level `id` are all unique across 4 277 items, and were identical across two fetches 4 minutes apart. **However that test is inconclusive for the reading id** — no rain reading updated in that 4‑minute window, so nothing *could* have changed. Treat rain's top‑level `id` as a per‑reading id **by analogy with water level, not by verification** — see open questions. Use `station.id` as the station key, which *is* verified stable.

---

## 6. Timezone and datetimes — VERIFIED (high confidence)

**Format:** `"YYYY-MM-DD HH:MM"` — no seconds, no `T`, **no offset or zone marker**. 805/805 water‑level and 4 277/4 277 rain values match.

**Zone: Asia/Bangkok (UTC+7) local time.** Evidence:

- Fetch issued at **2026‑09‑26 05:41:45 UTC** = **12:41:45 Asia/Bangkok** (the server's own `date:` header confirmed `05:48 GMT` on a later call).
- Maximum `waterlevel_datetime` in the payload: **`2026-09-26 12:30`**, carried by **405 of 805** stations.
- If the values were UTC, the newest reading would be 6 h 48 m **in the future** — impossible, and 405 stations would have to be simultaneously wrong.
- Read as Asia/Bangkok, `12:30` is 11 minutes before the fetch, which matches a 10‑minute telemetry cadence exactly.
- Same result on `rain_24h`: max `2026-09-26 12:00`, 41 minutes before fetch.

**Confidence: high.** The 7‑hour discriminator is far larger than any plausible clock skew, and the result is consistent across two endpoints and three fetches.

**Handling:** parse as wall‑clock in `Asia/Bangkok` and convert to UTC for storage (`timestamptz`). Do **not** `new Date("2026-09-26 12:30")` — that is parsed as local time by the runtime, which on Vercel is UTC, silently shifting every reading by 7 hours. Note AGENTS.md rule 18 requires display in Asia/Bangkok anyway, but storage should still be unambiguous.

DST is not a concern: Thailand has not observed DST since 1976.

---

## 7. Cadence, freshness and staleness

**Publication cadence is mixed and per‑station.** Minute‑of‑hour distribution of `waterlevel_datetime`:

`:00` → 390, `:30` → 407, `:10` → 3, `:20` → 2, `:40` → 3

So roughly two cohorts: a **10‑minute** cohort (visible at `:30`, the freshest slot) and an **hourly** cohort (`:00`). Between the 12:00 and 12:41 fetches, **475 of 805** readings advanced.

Rain: `:00` → 3 964, `:50` → 302, rest negligible. Effectively **hourly**.

Observed reading age at fetch time:

| | p50 | p90 | max | ≤15 min | ≤70 min | >24 h |
|---|---|---|---|---|---|---|
| Water level | 11 min | 101 min | **2 581 min (43 h)** | 405 | 472 | **4** |
| Rain | 101 min | 101 min | 761 min (12.7 h) | 0 | 1 780 | 0 |

> ### ⚠ The payload silently mixes fresh and days‑old readings
>
> **`BKC004` (Samut Prakan — in our Bangkok fixture) carries a reading from `2026-09-24 17:40`, 43 hours stale, and still reports `situation_level: 5`.** Nothing in the item marks it as stale; `situation_level` is computed from whatever the last reading was.
>
> This is a direct safety issue for a flood app. The adapter **must** compute `age = now − waterlevel_datetime` per reading and the UI **must** show it (AGENTS.md rule 2 already requires source + relative age). Recommend a hard staleness cutoff — readings older than ~3 h should render as "no current data", not as a severity band, and `scale.data.not_today` shows HII themselves grey out stale stations.

**Polling recommendation:** ingest cron every **10 minutes** for `waterlevel_load` matches the fastest cohort without waste. `rain_24h` is hourly and 4.5 MB — poll it every **30–60 minutes**; there is no conditional‑request support, so every poll is a full 4.5 MB transfer. AGENTS.md rule 11 (free tier) makes this worth respecting.

---

## 8. Attribution

Required on any surface showing this data (AGENTS.md rule 2):

- **Aggregator:** สถาบันสารสนเทศทรัพยากรน้ำ (องค์การมหาชน) — Hydro‑Informatics Institute (Public Organization), HII / สสน. — via thaiwater.net
- **Per‑reading owner:** from `reading.agency.agency_name` / `agency_shortname` (both `{th, en}`). Prefer `agency_shortname` in dense UI.

Agencies present in the `agency` registry (11): MD/จท. Marine Department · RID/ชป. Royal Irrigation Department · DWR/ทน. Department of Water Resources · DISASTER/ปภ. Department of Disaster Prevention and Mitigation · RTN/อศ Hydrographics Department, Royal Thai Navy · DNP/อส. Department of National Parks, Wildlife and Plant Conservation · EGAT/กฟผ. Electricity Generating Authority of Thailand · RPN/ม.รป. Rak Pa Nan Foundation · FOP/พพภ Friend in Need (of "Pa") Volunteers Foundation · HII/สสน. · BMA/สนน กทม. สำนักการระบายน้ำ กรุงเทพมหานคร.

Observed owners of actual readings:

- Water level (805): HII 330, RID 315, FOP 89, EGAT 71.
- Rain (4 277): DWR 1 965, HII 932, FOP 525, DISASTER 364, RID 253, TMD 128, EGAT 109, DNP 1.

Two notes:

- **`TMD` appears on 128 rain readings but is not in the `agency` registry.** Do not assume the registry is complete — resolve attribution from the reading's own `agency` object, and fall back gracefully.
- **BMA is in the registry but owns no readings here.** BMA drainage data is a separate source (`bma-dds`); do not expect to get it from this endpoint.

Some `agency_name.en` values contain typographic quotes (`Friend in Need (of “Pa”) Volunteers Foundation`) and trailing spaces (`"กรมชลประทาน "`). Trim on ingest.

---

## 9. Terms of use — UNVERIFIED

**No licence or terms could be established for this API.** See open questions. Until resolved, treat as: attribute fully and visibly, cache rather than proxy, do not redistribute bulk payloads, do not imply endorsement.

---

## 10. Fixtures

In `src/lib/sources/thaiwater/fixtures/`. All are **real upstream public data** captured 2026‑09‑26 05:41 UTC (AGENTS.md rule 30), keys sorted for stable diffs.

| File | Size | Contents |
|---|---|---|
| `waterlevel-bangkok.json` | 122 KB | Full envelope preserved. `.waterlevel_data.data` filtered to province codes `10`/`11`/`12`/`13` (Bangkok 9, Samut Prakan 4, Pathum Thani 4, Nonthaburi 2 = **19** readings). `scale`, `agency`, `basin`, `station`, `waterlevel_manual_data` kept verbatim; `province` filtered to the same 4. |
| `rain24h-bangkok.json` | 65 KB | `{result, data}` with data filtered to the same 4 provinces — **39** readings (Bangkok 15, Samut Prakan 11, Pathum Thani 10, Nonthaburi 3). |
| `waterlevel-edge-cases.json` | 29 KB | 9 hand‑picked real readings + 2 real manual readings + the real `scale` block. Robustness target. |

### `waterlevel-edge-cases.json` coverage

| Station | Case |
|---|---|
| `CPY015` | **Below bank (−1.82 m) yet `situation_level` 4** — the deep‑channel trap from §4 |
| `BKK021` | Over bank, level 5, Bangkok, has `en` name |
| `C.12` | **`tele_station_name.en` key absent**, Bangkok, below bank |
| `MOU246` | `storage_percent` 148.45 (well over 100), `river_name` **absent** |
| `T.1` | `offset` non‑null (−9.7) **and** `critical_level_msl` non‑null |
| `TBW024` | `situation_level` **1** (low end of the scale) |
| `URTU09` | **`flow_rate` and `discharge` both non‑null** (rare: 6/805) |
| `NPNPU01` | **`min_bank == 0` and `ground_level == 0`** → `storage_percent` null, `situation_level` **absent** |
| `Gt.9` | **`ground_level` key absent** → `storage_percent` null, `situation_level` **absent** |
| 2 × manual | **`waterlevel_msl: null`**, reduced station schema, no coordinates |

> **Three cases in the original brief do not exist in this endpoint and were not faked.** Verified across all 805 readings:
>
> - **A null `waterlevel_msl`: 0 occurrences** in `waterlevel_data.data` (also 0 absent, 0 empty, 0 non‑numeric). Null `waterlevel_msl` occurs *only* in `waterlevel_manual_data` (35/35) — which is why 2 manual items are included, so the adapter still has a real null‑level case to handle.
> - **A null `min_bank`: 0 occurrences.** The real degenerate form is `min_bank == 0` (6 readings), covered by `NPNPU01`.
> - **A null `situation_level`: 0 occurrences.** The field is **absent** for 15 readings, never `null`. Covered by `NPNPU01` and `Gt.9`.
>
> This distinction is load‑bearing for the zod schema: these fields need `.optional()`, not `.nullable()`. A schema written against the brief's assumption would reject valid payloads or mis‑handle absent keys.

Fixtures capture one moment. They cannot prove a field is *never* null — only that it was not null in 805 readings. Keep upstream parsing defensive regardless (AGENTS.md rule 13).

---

## Unverified / open questions

Treat every item here as unconfirmed. Do not encode any of it as fact.

1. **Terms of use / licence — UNRESOLVED.** No licence, terms, or acceptable‑use page was located for `api-v3.thaiwater.net`. `robots.txt` on the website is permissive but does not govern the API. No rate limits are published or returned in headers. **Action: confirm with HII before launch**, and until then keep polling conservative. This is the highest‑priority open item.
2. **`flow_rate` unit — UNKNOWN.** Only 6 of 805 non‑null (all from `URT*` stations). Values 0.00–112.65 as strings. Plausibly m/s, but 112.65 m/s is not a credible velocity, so it may be m³/s, or per‑station scaled. **Do not display until confirmed.**
3. **`discharge` unit — UNKNOWN.** 288 non‑null, 0.00–2594.00, strings. m³/s ("ลูกบาศก์เมตรต่อวินาที") is the Thai convention and fits the range for major rivers, but this was **not** verified against any published figure. **Do not display until confirmed.**
4. **`rain_24h` / `rain_1h` units — mm, INFERRED not verified.** The endpoint name, the 0–314 range over 24 h, and Thai meteorological convention all point to mm, and 314 mm/24 h is consistent with an active flood emergency. But no upstream statement of units was found. High confidence, not verified.
5. **Whether `rain_24h` is a rolling 24‑hour total or a fixed daily accumulation** is unknown, as is its reset boundary (Thai rainfall days often run 07:00–07:00). This materially changes interpretation. **Unverified.**
6. **Rain top‑level `id` stability — NOT ESTABLISHED.** The two rain fetches were only 4 minutes apart and *no* reading advanced, so the test proved nothing. Assumed per‑reading by analogy with water level. Re‑test with fetches >1 hour apart.
7. **`offset` (235 non‑null)** — semantics and datum unknown. Values range from 0 to 128.3 and include negatives (−9.7). Possibly a gauge‑zero to MSL correction. Not used by any formula verified here.
8. **`qmax` (279 non‑null)** — presumably a maximum discharge capacity, unit unknown. Unverified.
9. **`is_key_station` (true for 199)** — selection criteria unknown. Might be a reasonable "show these first at low zoom" hint, but that is a guess.
10. **`warning_zone`** (rain `geocode` only, present on all 4 277) — meaning unknown. Values look like province‑ish codes but this was not checked.
11. **`critical_level_msl` / `critical_level_m` / `warning_level_m`** — these look like official alarm thresholds, but they are **not** inputs to `situation_level` (verified: `situation_level` is fully explained by `storage_percent` alone). Their provenance and authority are unknown. `warning_level_m` is null for 803/805 and effectively dead. **Do not build alerting on these without confirmation.**
12. **`result` field failure values** — only `"OK"` observed. The error shape (HTTP status, body) on upstream failure is unknown. The adapter must handle non‑OK, malformed, and truncated responses regardless (AGENTS.md rule 5: fail the layer, never the render).
13. **`.station.data` was `{tele_waterlevel: null, canal_waterlevel: null}` in every fetch.** Whether it is ever populated is unknown. `canal_waterlevel` hints at a canal station type not present in this payload — potentially relevant for Bangkok, worth investigating separately.
14. **Station roster churn** — no station appeared or disappeared across the two fetches. Long‑term churn rate is unknown; the ingest must tolerate additions and removals.
15. **`basin_name.en` can be `""`** (e.g. basin id 29, `นอกประเทศไทย`). Whether `province_name.en` or `amphoe_name.en` can also be empty was not exhaustively checked.
16. **Historical/time‑series endpoints** were not investigated — only these two current‑state endpoints. If we want trend sparklines, that is a separate investigation.
