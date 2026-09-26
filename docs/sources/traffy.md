# Source: `traffy` — Traffy Fondue (BMA × NECTEC)

**Status:** investigated and verified against live responses.
**Investigated:** 2026-09-26 (Asia/Bangkok), against the live public endpoint.
**Scope of this document:** the verified upstream contract only. The adapter, zod schema and
tests are written separately and must not assume anything that is not stated here.

---

## 1. Provenance classification (read this first)

NamWatch classifies Traffy Fondue as provenance **`official_channel`**.

- It is **citizen-reported**, but tracked in the official BMA complaint queue and worked by named
  BMA agencies (`org` / `org_action`).
- It is **not an official sensor** (unlike `thaiwater` / `bma-dds`). A Traffy item is one person's
  account of a place, not a measurement.
- It is **not NamWatch crowd data**. It did not go through our report form, our decay model or our
  confirmation votes.

Per AGENTS.md hard rule 2 it must be visually and textually distinguishable from both. Use the
glossary wording already agreed in `docs/glossary.md`:

| TH | EN |
|---|---|
| เรื่องแจ้งผ่านช่องทางราชการ | Filed through an official channel |

Never render a Traffy item as "verified", "official", "confirmed", or as a NamWatch community
report. Always show source + relative age (AGENTS.md rule 2).

---

## 2. Endpoint

```
GET https://publicapi.traffy.in.th/teamchadchart-stat-api/geojson/v1
```

- No authentication, no API key.
- Always send `User-Agent: NamWatch/0.1 (+https://github.com/namwatch/namwatch)` (AGENTS.md rule 13).
- `Content-Type: application/json; charset=UTF-8`. Returns a GeoJSON `FeatureCollection` wrapped in
  a non-standard stats envelope (see §4).
- Served through Kong → Apache/PHP. Observed response headers include `access-control-allow-origin: *`
  and **no** `Cache-Control` and **no** rate-limit headers. We call it server-side only regardless
  (AGENTS.md rule 6).
- Uncached queries are slow: an uncached `limit=3000&problem_type=…` took **7.9 s** (`exec_time`
  reported `7.898s`) versus ~0.08 s when served from cache. Give the adapter a generous timeout
  (≥ 20 s) and back off on failure; a failure must degrade only this layer (AGENTS.md rule 5).

---

## 3. Query parameters

### 3.1 CONFIRMED — verified to change the response

Each of these was verified by comparing returned `ticket_id` sets, feature timestamps, feature
field values and/or `total` against an unparameterised control request. A `200` alone was not
accepted as evidence.

| Param | Type | Effect | Evidence |
|---|---|---|---|
| `limit` | integer | Number of features returned. Raises the default cap of 300. | `limit=5` → 5 features; `limit=1000` → 1000 features. |
| `offset` | integer | Skips N records from the start of the ordered result set. | `limit=10&offset=0` and `limit=10&offset=5` shared exactly 5 `ticket_id`s, shifted by 5. |
| `start` | `YYYY-MM-DD` | Inclusive lower bound on `timestamp`. | `start=2026-09-01&end=2026-09-05` → every returned `timestamp` fell inside that window; `total` became `6023` instead of the unfiltered `1456997`. |
| `end` | `YYYY-MM-DD` | Upper bound on `timestamp`. | Same test as `start`. Both were needed; neither was tested alone. |
| `problem_type` | Thai string | Filters by problem category. | `problem_type=น้ำท่วม` → all 20/20 sampled features had `problem_type_fondue` containing `น้ำท่วม`; `total` = `32440` vs unfiltered `1456997`. |
| `state_type` | enum string | Filters by workflow state (the `state_type_latest` vocabulary, §7). | `state_type=finish` → all returned features had `state_type_latest="finish"` / `state="เสร็จสิ้น"`; `state_type=follow` → all `follow` / `ติดตามเรื่อง`. Control request returned a mix of `start` and `inprogress`. |
| `sort` | `asc` | Reverses the default ordering to oldest-first. | `sort=asc&limit=20` returned 2021-09-03 … 2022-01-16 records; the control returned 2026-09-26 records. Only the literal value `asc` was tested. |

**Default ordering** is by `timestamp` **descending** (newest first). Verified on every
unparameterised and `limit`-only response.

### 3.2 TRIED AND COULD NOT CONFIRM — treat as unsupported

All of the following returned HTTP 200 but produced a response whose `ticket_id` list was
**byte-identical to the control request issued in the same moment**, i.e. the parameter was
silently ignored. Do not build on them.

`bbox` · `min_lng` / `min_lat` / `max_lng` / `max_lat` · `sw` / `ne` · `district` (Thai value) ·
`district` (English value) · `districts` · `province` · `org` · `name` · `q` · `keyword` ·
`problem_type_fondue` · `state` (Thai value) · `ticket_id` · `page` · `skip` · `order=asc` ·
`start_date` / `end_date` · `startdate` / `enddate`

Notably: **there is no bounding-box or district filter on this endpoint.** Geographic and
district scoping must be done client-side in the adapter, after fetching.

### 3.3 The 300 cap and the real ceiling

- With no `limit`, the endpoint returns **300** features.
- `limit` raises this, but the server caps hard at **1000** features per request.
  `limit=3000` → 1000 features. `limit=20000` → 1000 features. Both reported `count: 1000`.
- Deeper access therefore requires paging with `limit=1000` + `offset`, or narrowing with
  `start` / `end` / `problem_type` / `state_type`.
- For NamWatch's purpose (recent Bangkok flood items) a single
  `?problem_type=น้ำท่วม&limit=1000` request covered **2026-09-26 03:33 → 12:42**, i.e. roughly
  **9 hours** of flood reports. During a quieter period this window will be much longer; during a
  worse event it will be shorter. The adapter must not assume a fixed time window — check the
  oldest returned `timestamp` against the previous run's high-water mark and page with `offset`
  if the window did not reach back far enough.

### 3.4 Envelope counters — what each means

| Field | Meaning | Evidence |
|---|---|---|
| `count` | Number of features actually in `features` for this response. | Always equalled `features \| length` in every observed response (300, 5, 20, 1000, …). |
| `count_total` | Size of the entire Traffy dataset, ignoring all filters. | `1456997`, unchanged across every filtered and unfiltered request in the session. |
| `total` | Number of records matching the applied filters, server-side. | `32440` for `problem_type=น้ำท่วม`; `6023` for a 5-day `start`/`end` window; `1456997` (== `count_total`) for a completely unparameterised request. |

**Caveat, verified:** `total` is returned as **`0`** whenever a request carries only
non-filtering parameters (e.g. `limit=20` alone, or an ignored parameter). `0` here means
"not computed", **not** "no matches". The adapter must never treat `total === 0` as an empty
result set — use `count` / `features.length` for that.

`total_by_group_tag`, `satisfied`, `dissatisfied`, `satisfied_by_group_tag`,
`dissatisfied_by_group_tag` are dashboard aggregates for the whole Traffy programme. They are not
needed by NamWatch and their exact denominators are **unverified** (see §11).

### 3.5 `source` — a free staleness signal

The envelope `source` string reports whether the payload came from cache or the database, the
cache fill time and the TTL. Observed values:

```
geojson cache 2026-09-26 12:15:08 (expire 1800s)
geojson db (expire 1800s)
sum_state cache 2026-09-26 12:45:37 (expire 2400s) | sum_state_by_group_tag db (expire 2400s) | geojson cache 2026-09-26 12:45:40 (expire 600s)
```

- `cache <timestamp>` = served from a cache filled at that Asia/Bangkok wall-clock time.
- `db` = cache miss, computed fresh (and slow).
- TTL varies by query shape: **1800 s** observed for the default/unfiltered geojson, **600 s** for
  a filtered flood query. It is **not** a fixed constant — do not hard-code it.

This is worth parsing into the freshness we display, but parse it **defensively** — the format is
undocumented and may change. Fall back to the newest feature `timestamp` if parsing fails.

---

## 4. Response envelope

```jsonc
{
  "status": "success",           // string
  "message": "",                 // string, empty on success. Unverified on error (see §11)
  "exec_time": "0.077s",         // string with an "s" suffix — not a number
  "source": "geojson cache …",   // see §3.5
  "total": 1456997,              // number — see §3.4
  "total_by_group_tag": 1011114, // number
  "sum_state": { … },            // object: state_type -> count, whole dataset
  "sum_state_by_group_tag": { … },
  "satisfied": 383493,
  "dissatisfied": 89008,
  "satisfied_by_group_tag": 308888,
  "dissatisfied_by_group_tag": 61924,
  "count_total": 1456997,        // number
  "count": 300,                  // number
  "type": "FeatureCollection",
  "features": [ … ]
}
```

Observed `sum_state` keys (whole-dataset counts at investigation time):

```json
{ "": 17, "finish": 1176948, "follow": 43274, "forward": 119690,
  "inprogress": 89246, "irrelevant": 25477, "start": 2345 }
```

Note the **empty-string key** `""`. A small number of records carry no `state_type`. None appeared
in the 2,259 features sampled, so the corresponding `state` value is unverified (§11).

### `geometry`

- `geometry.type` was `"Point"` for **all** 2,259 sampled features. No other geometry type was
  observed, but "always Point" is not guaranteed by any documentation — parse defensively.
- `geometry.coordinates` is a 2-element array, **`[longitude, latitude]`** — standard GeoJSON
  order, **CONFIRMED**. Across the 300-feature default sample:
  `coordinates[0]` ranged 100.33431 … 100.86291 and `coordinates[1]` ranged 13.61219 … 13.91897.
  Those are Bangkok longitudes and latitudes respectively; the reverse reading would place the
  points in Somalia. Values land squarely inside Thailand.
- Coordinates are the **complainant-supplied incident location**, already public upstream. Our own
  `home` / `help` coordinate-masking rule (AGENTS.md rule 10) applies to NamWatch reports, not to
  these; we still store and serve them through our own API, never client → Supabase.

---

## 5. `features[].properties` — field table

34 keys, present on **every** feature in all 2,259 sampled (no key was ever absent; absence is
always expressed as an explicit `null`). Counts below are over a 2,259-feature deduplicated sample
spanning 2021-09-03 → 2026-09-26.

| Field | JSON type | Nullable | Notes |
|---|---|---|---|
| `ticket_id` | string | no (0/2259) | Public reference, e.g. `2026-KPDFNB`. Format `YYYY-<6 alnum>`. **Our unique id — see §8.** |
| `message_id` | number | no | Internal integer id, e.g. `2216792`. Monotonically increasing with time. Also unique in-sample. |
| `description` | string | **no (0/2259)** | Free-text citizen complaint, Thai. Length 2–255 chars in the flood sample (avg 143). **Contains PII — see §9.** |
| `description_reporter` | null | **always null (2259/2259)** | Never populated in any sample. Underlying type unknown. Treat as `unknown`/ignore. |
| `note` | string \| null | yes (~34%) | Agency routing note, e.g. `เขตบางซื่อ เชิญร่วมไปยัง ฝ่ายโยธา เขตบางซื่อ`. May contain newlines. |
| `photo_url` | string | **no (0/2259)** | Absolute URL. Always `https://storage.googleapis.com/traffy_public_bucket/…`. Extensions observed: `.jpeg` (766), `.jpg` (230), `.png` (4) per 1000. See §10. |
| `after_photo` | string \| null | yes (~97% null) | "After" media, same bucket. **Not always an image** — `.jpg`, `.jpeg`, `.png`, and also `.mp4` and `.mov` were observed. Do not assume `<img>`. Path shape also varies: usually `…/attachment/YYYY-MM/<hash>.<ext>`, but a shared placeholder `…/TeamChadChart/fondue_photo.png` also occurs. |
| `problemtype_photo` | string | no | **Relative** path (e.g. `attachment/2021-09/s-1630552986.779968.png`), unlike `photo_url`. Appears to be a category icon. Base URL unverified (§11). |
| `problem_type_fondue` | string[] | no (never null, never empty) | Category tags. 1 or 2 entries in the recent sample (920 / 80 per 1000); up to 3 seen in older data. Vocabulary in §6. |
| `problem_type_abdul` | null | **always null (2259/2259)** | Never populated. Meaning unknown — do not guess. |
| `type` | string | no | The `problem_type_fondue` array **joined with `,`** (e.g. `อื่นๆ,น้ำท่วม`). Verified: mismatches against `problem_type_fondue[0]` numbered exactly 80/1000, matching the 80 multi-tag features. Redundant — prefer the array. |
| `state` | string | no | Thai workflow label. Vocabulary in §7. |
| `state_type_latest` | string | no | Machine workflow state. Vocabulary in §7. **Filterable via `state_type`.** |
| `org` | string[] | no | Agencies the ticket is associated with. 2–7 entries. E.g. `["ร้องทุกข์ กทม. 1555","กรุงเทพมหานคร","ศูนย์ควบคุมระบบป้องกันน้ำท่วม กทม.","เขตบางกะปิ"]`. |
| `org_action` | string[] | no | Same universe of values; in observed samples the same set in a different order. Whether the two ever differ in *membership* is **unverified** (§11). |
| `address` | string | no | Full Thai address line, e.g. `แขวงคลองจั่น เขตบางกะปิ กรุงเทพมหานคร`. |
| `province` | string | no (0/2259) | e.g. `กรุงเทพมหานคร`. **Non-Bangkok values exist** — `นนทบุรี` and `ศรีสะเกษ` appeared in the 2021–2022 sample. Filter on this. |
| `district` | string \| null | **yes** | เขต. Null in 6/1000 of the oldest sample, 0/1000 in recent. 38 distinct districts in a 1000-item recent flood sample. |
| `subdistrict` | string \| null | **yes** | แขวง. Null on exactly the same 6 features as `district`. |
| `timestamp` | string | no | Creation time. Format `YYYY-MM-DD HH:mm:ss`, **no timezone suffix**. See §8. |
| `last_activity` | string | no | Last state change. Same format. `last_activity >= timestamp` held for 1000/1000; equal for 337/1000. |
| `timestamp_inprogress` | string \| null | yes (~55% null) | Same format. Null until the ticket enters `inprogress`. |
| `timestamp_finished` | string \| null | yes (~99% null) | Same format. Null until finished. |
| `duration_minutes_inprogress` | number \| null | yes (~55% null) | Minutes. Null in lockstep with `timestamp_inprogress` (552 nulls each in the same 1000). **CONFIRMED** = `floor((timestamp_inprogress − timestamp) / 60s)`, exact on 754/754 features where both were present. |
| `duration_minutes_finished` | number \| null | yes (~99% null) | Minutes. Null in lockstep with `timestamp_finished` (991 nulls each). **CONFIRMED** = `floor((timestamp_finished − timestamp) / 60s)`, exact on 886/886 features where both were present. |
| `duration_minutes_total` | number \| null | yes (~55% null) | Minutes. Equals `duration_minutes_finished` on 877/886 finished tickets (99%), but not all, and for the 589 *unfinished* tickets carrying a value it matches neither `timestamp → last_activity` nor anything else obvious. Definition **unverified** (§11). Derive elapsed time yourself from the timestamps instead. |
| `count_reopen` | number | no | Times reopened. `0` for most; >0 exists (50/2259). |
| `view_count` | number | no | Public view counter. |
| `like` | number | no | |
| `dislike` | number | no | |
| `total_point` | number | no | Meaning **unverified** (§11). Do not display. |
| `star` | null | **always null (2259/2259)** | Presumably a satisfaction rating, but never populated in any sample. Do not rely on it. |
| `see_info` | boolean | no | `true` for 996/1000, `false` for 4/1000. Meaning **unverified** (§11) — possibly a public-visibility flag. Do not use it to gate display without confirming. |
| `ai` | object \| null | **yes** (~9% null overall; 207/1000 null in 2021–22 data, 1/1000 in recent) | NECTEC AI enrichment. Shape below. |

### `ai` object

| Sub-field | Type | Nullable | Notes |
|---|---|---|---|
| `summary` | string | no (when `ai` is non-null) | Short Thai summary, e.g. `น้ำท่วมขัง`. |
| `categories` | array \| null | yes | Array of `{ category: string, confidence: number }`. `confidence` observed 0–100 (integer-looking). |
| `sentimental_percent` | number \| null | yes | 0–100. Meaning **unverified** (§11) — not obviously "sentiment positivity"; a 90 was attached to a matter-of-fact complaint. |
| `sentimental_reason` | string \| null | yes | Thai prose explaining the score. |

`ai.categories[].category` draws on a **wider** vocabulary than `problem_type_fondue`, including
`ท่อระบายน้ำ` (storm drain) and `เรื่องฉุกเฉิน` (emergency). It is an **AI guess**, not an agency
classification. Do not use it to drive severity, and do not display it as fact.

---

## 6. `problem_type_fondue` vocabulary and flood tagging

Full distinct set observed across the 2,259-feature sample (occurrence counts):

```
น้ำท่วม 1133 · อื่นๆ 648 · ทางเท้า 160 · ผิดกฎจราจร 153 · ถนน 114 · ความปลอดภัย 96 ·
จุดเสี่ยง 94 · ความสะอาด 66 · ขยะ 51 · ไฟฟ้า 51 · ภัยทางถนน 49 · ขอความช่วยเหลือ 27 ·
เสนอแนะ 23 · ต้นไม้ 13 · อาคารสถานที่ชำรุด 12 · เสียง 12 · ฝุ่นควัน&กลิ่น&PM2.5 10 ·
ประปา 5 · ภัยอื่นๆ 5 · สัตว์ 5 · สายสื่อสาร 5 · อุทกภัย 5 · ขอใช้บริการ 4 ·
หาบเร่แผงลอย 4 · เผาในที่โล่ง 4 · คุ้มครองผู้บริโภค 3 · อุปกรณ์ชำรุด 3 ·
บริจาค/ช่วยเหลือ 2 · ผู้พิการ+ใช้ล้อ 2 · สถานบันเทิง 2 · กรุงเทพโปร่งใส 1 · คนเร่ร่อน 1 ·
ชื่นชม 1 · ถนน ทางเท้า ที่จอดรถ 1 · ทุจริต 1 · ภัยจากการคมนาคมขนส่ง 1 · ภัยแล้ง 1 ·
อัคคีภัย 1 · อุบัติเหตุ 1 · ไฟป่า 1
```

**This list is a sample, not a closed enum.** It came from 2,259 of 1,456,997 records. The zod
schema must accept arbitrary strings here and must not fail on an unseen tag.

### Which tags indicate flooding

| Tag | Gloss | Use as flood? |
|---|---|---|
| `น้ำท่วม` | Flooding / waterlogging | **Yes.** The primary and overwhelmingly dominant flood tag, and the value accepted by the `problem_type` filter. |
| `อุทกภัย` | Flood (as a disaster) | **Yes, but always co-occurring.** All 5 occurrences also carried `น้ำท่วม`, so it adds no items on its own. Include it for safety. |
| `ภัยแล้ง` | Drought | **No.** Opposite condition. |
| `ประปา` | Tap water / water supply | **No.** Utility, not flooding. |
| `ท่อระบายน้ำ` | Storm drain | **Not applicable** — appears only in `ai.categories`, never in `problem_type_fondue`. |

Recommended predicate: `problem_type_fondue.some(t => t === 'น้ำท่วม' || t === 'อุทกภัย')`.
Do **not** substring-match on `น้ำ` ("water") — it would also catch `ประปา`-adjacent wording and
is fragile.

Note that `problem_type=น้ำท่วม` (the server filter) is cheaper than fetching everything and
filtering locally, and in a 20-feature probe it returned only items tagged `น้ำท่วม`. Whether the
server filter is "array contains" or "exact single-tag match" is **unverified** (§11) — every item
in that probe happened to have exactly one tag. Until confirmed, if completeness matters, prefer
the unfiltered fetch plus a local predicate; the `น้ำท่วม` share of recent traffic is high (839 of
1000 unfiltered features), so the bandwidth saving is small anyway.

---

## 7. State vocabulary

`state_type_latest` is the machine state (and the value the `state_type` query param accepts).
`state` is the Thai label shown to the public, and **several distinct Thai labels map onto the
same `state_type_latest`**. Always key logic off `state_type_latest`; show `state` only as text.

| `state_type_latest` | `state` (TH) | EN gloss | Seen | Meaning |
|---|---|---|---|---|
| `start` | รอรับเรื่อง | Awaiting acceptance | 590 | Filed; no agency has picked it up yet. |
| `inprogress` | รับเรื่อง | Accepted | 34 | An agency has taken the ticket. |
| `inprogress` | กำลังดำเนินการ | In progress | 472 | Being worked on. |
| `inprogress` | จัดทำนโยบาย | Policy being drafted | 5 | Escalated to a policy response rather than a field fix. |
| `forward` | ส่งต่อ | Forwarded | 178 | Routed to another agency. |
| `forward` | ส่งต่อ(ใหม่) | Forwarded (re-routed) | 1 | Rare variant. |
| `follow` | ติดตามเรื่อง | Following up | 44 | Awaiting/chasing a response. |
| `finish` | เสร็จสิ้น | Completed | 861 | Closed as done. |
| `irrelevant` | ไม่เกี่ยวข้อง | Not relevant | 70 | Rejected as out of scope. |
| `irrelevant` | ไม่เกี่ยวข้อง / ยกเลิก | Not relevant / cancelled | 4 | Rejected or withdrawn. |
| `""` (empty) | *(unknown)* | — | 0 in sample | `sum_state` reports 17 such records dataset-wide. Corresponding `state` unverified. |

Rough workflow: `start` → `inprogress` → (`forward` / `follow`) → `finish`, with `irrelevant` as a
terminal rejection. The exact transition rules are **not documented upstream** and this ordering is
inferred, not verified.

**Freshness implication.** `finish` and `irrelevant` items should not be shown as live flooding.
`last_activity` (not `timestamp`) is the right basis for "how stale is this status".

**Do not** map these states onto NamWatch depth bands or severity. They describe the *complaint's
administrative status*, not the water. Depth bands come only from `src/config/depth-bands.ts`
(AGENTS.md rule 4).

---

## 8. Unique identifier, ordering, and time

### Unique id — use `ticket_id`

**Recommendation: `ticket_id`, as the upstream natural key.**

- Unique across 1000/1000 and 2259/2259 sampled features.
- Stable across fetches: `2026-KPDFNB` returned identical content in separate requests minutes
  apart.
- Human-meaningful and publicly quotable — it is the reference a citizen sees, so it is the right
  thing to key on if we ever deep-link or de-duplicate against Traffy's own UI.
- Format `YYYY-<6 uppercase alnum>`. Note the year prefix means it is **not** globally sortable and
  **not** monotonic; do not use it for ordering or as a high-water mark.

`message_id` (integer, 2214312 … 2216675 in a recent 1000) is also unique in-sample and *is*
monotonic with time, which makes it useful as an **ingest high-water mark**. But it is an internal
identifier with no documented stability guarantee, so store it alongside, don't key on it.

Suggested storage: primary external key `ticket_id`, with `message_id` kept as a secondary column
for incremental ingest.

### Ordering

Default order is `timestamp` **descending**. `sort=asc` flips it to ascending. Ordering is by
`timestamp` (creation), **not** `last_activity` — so a very old ticket that was just updated will
**not** appear at the head of the default listing. An adapter that only reads the head of the
default order will miss status changes on older tickets. Plan for that.

### Timezone — Asia/Bangkok (UTC+7), naive. **High confidence.**

All five timestamp fields use `YYYY-MM-DD HH:mm:ss` with **no offset, no `T`, no `Z`**
(1000/1000 matched that exact pattern). They are **Asia/Bangkok local wall-clock time**.

Evidence, collected in one moment during the investigation:

| Observation | Value |
|---|---|
| Newest `last_activity` in the response | `2026-09-26 12:12:30` |
| Wall clock, UTC, at fetch time | `2026-09-26 05:48:04` |
| Wall clock, Asia/Bangkok, at fetch time | `2026-09-26 12:48:04` |

The newest record sat 36 minutes *behind* Bangkok local time and 6 h 24 min *ahead* of UTC.
Reading them as UTC would place the newest complaint about 6½ hours in the future. Corroborated
independently by the envelope `source` cache stamp (`geojson cache 2026-09-26 12:15:08`), which is
also Bangkok local and matched the newest feature.

**Handling:** parse with an explicit `Asia/Bangkok` zone and store as `timestamptz`. Never let
`new Date("2026-09-26 12:12:30")` run — it resolves against the *server's* local zone, which on
Vercel is UTC, silently shifting every Traffy item 7 hours. Display per AGENTS.md rule 18
(relative time for freshness; Buddhist Era for Thai absolute dates).

---

## 9. PII in `description` — action required

`description` is **free text written by members of the public** and it does contain personal
information. Measured over the 1,000-feature flood sample:

| Pattern | Hits / 1000 | Example (shape only) |
|---|---|---|
| Thai phone number | **2** | `081-867-9067`, `0624249149` — both full, live-looking mobile numbers in plain text |
| `บ้านเลขที่` + digits (house number) | **25** | `บ้านเลขที่ 66`, `บ้านเลขที่ 56/7` |
| `โทร` (tel) | 7 | |
| `ติดต่อ` (contact) | 14 | |
| `ชื่อ` (name) | 5 | |
| `ผู้แจ้ง` (reporter) | 2 | |
| `เบอร์` (number) | 1 | |

Many descriptions also arrive as a **structured block** appended by the intake channel:

```
ปัญหา: …
บ้านเลขที่: 563
หมู่บ้าน: แฮปปี้แลนด์ทาวน์เฮ้าส์เก่า (ซอย 2)
ถนน: แฮปปี้แลนด์
```

A further pattern worth flagging: some descriptions open with what looks like the **reporter's
nickname** immediately after `ปัญหา:` (e.g. `ปัญหา: เบสท์ ภายในซอย…`, where `เบสท์` is a common
Thai nickname, not part of the sentence). This is a judgement call from a small number of examples,
not a measured rate — but it means a name can appear with no keyword marker at all.

**Recommendation for the adapter/UI step (not decided here):** do **not** render raw `description`
verbatim. Options, roughly in order of preference:

1. Prefer `ai.summary` (short, Thai, already abstracted, e.g. `น้ำท่วมขัง`) as the display string,
   falling back to a truncated `description` only when `ai` is null (~9% of items, more in older
   data).
2. If raw text must be shown, strip at minimum: digit runs matching Thai phone formats, and the
   `บ้านเลขที่:` line of the structured block.
3. Truncate with `Intl.Segmenter`, never by character count (AGENTS.md rule 17).

This data is already public upstream, so republishing it is not a new disclosure — but
concentrating it on a map with a NamWatch byline changes the exposure, and rule 25 forbids any of
it reaching analytics. Worth an explicit decision before the UI ships.

**The fixtures are deliberately NOT redacted** — they are verbatim upstream public data, per the
fixture rule in AGENTS.md rule 30 — so tests can exercise the real shapes. Treat the fixture
descriptions as production-like data.

---

## 10. Photos

- `photo_url` is **publicly accessible with no authentication.** Verified with a single request:
  `HTTP/2 200`, `content-type: image/jpeg`, `cache-control: public, max-age=3600`. No cookie, no
  token, no referer requirement.
- Host is always `storage.googleapis.com` (bucket `traffy_public_bucket`) across 1000/1000.
- `photo_url` was **never null** in 2,259 features.
- `after_photo` may be **video** (`.mp4`, `.mov` observed), not only an image.
- Per AGENTS.md rule 26, NamWatch photos are served only through `/api/v1/photos/:key`. Traffy
  photos are third-party assets on a third-party CDN. Hot-linking them leaks our users' IPs to
  Google and ties our page load to an upstream we don't control. Decide deliberately whether to
  proxy, cache, or simply link out to the Traffy ticket. Not resolved here.

---

## 11. Attribution, terms of use, and cadence

### Attribution

Traffy Fondue is operated by **NECTEC** for the **BMA**. Use the agency names already fixed in
`docs/glossary.md`:

| Role | TH | EN |
|---|---|---|
| Platform operator | ศูนย์เทคโนโลยีอิเล็กทรอนิกส์และคอมพิวเตอร์แห่งชาติ (เนคเทค) | National Electronics and Computer Technology Center (NECTEC) |
| Parent organisation | สำนักงานพัฒนาวิทยาศาสตร์และเทคโนโลยีแห่งชาติ (สวทช.) | National Science and Technology Development Agency (NSTDA) |
| City / data owner | กรุงเทพมหานคร | Bangkok Metropolitan Administration (BMA) |
| Service name | ทราฟฟี่ ฟองดูว์ | Traffy Fondue |

Suggested credit line — **`th-review`, my Thai wording, please check before shipping**:

- TH: `ข้อมูลจาก Traffy Fondue (กรุงเทพมหานคร × เนคเทค)`
- EN: `Data from Traffy Fondue (BMA × NECTEC)`

### Terms of use — **NOT ESTABLISHED**

I could not find published terms of use, a licence, or a rate-limit policy for
`publicapi.traffy.in.th`. Specifically:

- `https://publicapi.traffy.in.th/teamchadchart-stat-api/` returns the bare string `OK` — there is
  no API documentation at the service root.
- No `Cache-Control`, no `X-RateLimit-*`, no `Link` licence header on responses.
- A web search surfaced a Traffy "Open Data" page (`traffy.in.th/?page_id=27351`) that resolves to
  a Notion-backed page I could not read the content of; it may carry the licence.

The endpoint is unauthenticated, CORS-open (`access-control-allow-origin: *`), and feeds a public
dashboard, so it is clearly *intended* to be read publicly. That is **not** the same as a licence
to redistribute. SPEC §16 already lists "contact HII and NECTEC for permission and attribution
wording" as an open item — **this remains open and blocking for anything beyond development.**
Until it is resolved:

- Keep the polite `User-Agent`.
- Cache and do not re-fetch faster than the upstream's own TTL (§3.5).
- Credit visibly as above.

### Cadence

- Upstream server-side cache TTL observed at **600 s and 1800 s** depending on query shape. Polling
  faster than the TTL returns byte-identical cached data and wastes the free tier
  (AGENTS.md rule 11).
- New tickets genuinely arrive fast during an event — 1000 flood tickets spanned about 9 hours
  (≈ 2/min) on the investigation day.
- SPEC §5 lists this source at **5–10 min**. Given the observed cache TTL, **10 minutes** is the
  right ingest interval; 5 minutes would mostly re-fetch cache. The existing `ingest.yml` 10-minute
  cron is appropriate.
- CI must never hit upstream (AGENTS.md rule 12) — tests run against the fixtures in §13.

---

## 12. Related endpoint (NOT the one we use)

A sibling endpoint exists and behaves differently:

```
GET https://publicapi.traffy.in.th/share/teamchadchart/search
```

- Returns `201` with `{ "status": true, "total": …, "results": [ … ] }` — a **plain array, not
  GeoJSON**, and its `type` field was `null` on the records sampled.
- **It does support `district`** — CONFIRMED: adding `district=บางกะปิ` changed `total` from
  `1463255` to `48955`.

Recorded because the district filter our GeoJSON endpoint lacks does exist here. Its full field set
was **not** investigated and its records are **not** interchangeable with the GeoJSON ones. Do not
mix the two without a separate investigation and its own `docs/sources/` entry.

---

## 13. Fixtures

In `src/lib/sources/traffy/fixtures/`. Both are **verbatim upstream public data** captured
2026-09-26, with the full envelope preserved and only the `features` array subset (`count` adjusted
to match). No values were edited, synthesised, or redacted.

### `flood-bangkok.json` — 387,672 bytes (~378 KB), 105 features

The normal-path fixture. Drawn from an **unfiltered** `limit=1000` fetch, then filtered locally to
`province === "กรุงเทพมหานคร"` **and** `problem_type_fondue` containing `น้ำท่วม` — deliberately
unfiltered upstream so that multi-tag items survive (a server-side `problem_type` filter may not
return them; see §6).

- 105/105 are flood-tagged Bangkok items
- 30 distinct districts
- 14 features with multiple `problem_type_fondue` entries
- state mix: `start` 47, `inprogress` 49 (45 `กำลังดำเนินการ` + 4 `รับเรื่อง`), `forward` 8, `finish` 1
- `timestamp` range 2026-09-26 10:52:39 … 12:12:30 (Asia/Bangkok)

### `edge-cases.json` — 36,130 bytes (~35 KB), 11 features

Hand-picked from a 2,259-feature pool spanning 2021-09 → 2026-09, chosen so each feature carries as
many edge conditions as possible.

| `ticket_id` | Covers |
|---|---|
| `2026-TR46ZT` | `start` / รอรับเรื่อง; **`count_reopen = 1`** (only reopened item); flood-tagged |
| `2026-99779A` | `start` / รอรับเรื่อง; **2-character `description`** (degenerate text — the closest real stand-in for a null description); **`ai` is `null`** |
| `2026-GY44ND` | `inprogress` / **รับเรื่อง** |
| `2026-W3EFGN` | `inprogress` / กำลังดำเนินการ; **`after_photo` is a `.mov` video, not an image**; flood-tagged |
| `2026-WNKHJH` | `inprogress` / **จัดทำนโยบาย** (rare label); flood-tagged |
| `2022-7BNF76` | `forward` / ส่งต่อ; **`district` and `subdistrict` are `null`**; **non-Bangkok province** (`ศรีสะเกษ`); **`ai` is `null`** |
| `2026-XGAXCH` | `forward` / **ส่งต่อ(ใหม่)** (rare label); longest description (216 chars); flood-tagged |
| `2022-6R9GPP` | `follow` / ติดตามเรื่อง; **`ai` is `null`**; 2 `problem_type_fondue` entries |
| `2022-76K38B` | `finish` / เสร็จสิ้น; **3 `problem_type_fondue` entries including `น้ำท่วม`**; `null` district and subdistrict; non-Bangkok (`ศรีสะเกษ`); `ai` null; the **only feature with a fully populated lifecycle** (`timestamp_inprogress`, `timestamp_finished`, and all three `duration_minutes_*`) |
| `2022-8ZMDHK` | `irrelevant` / ไม่เกี่ยวข้อง; 3 tags |
| `2026-43EF3Y` | `irrelevant` / **ไม่เกี่ยวข้อง / ยกเลิก** (rare label); `after_photo` is a **placeholder** at a different bucket path (`…/TeamChadChart/fondue_photo.png`, not the usual `…/attachment/YYYY-MM/<hash>.<ext>`) — do not assume the `attachment/` path shape |

All 10 distinct `state` strings in §7 are represented. 5 of the 11 are flood-tagged.

### Edge cases the task asked for that DO NOT EXIST upstream

- **A null `photo_url`** — `photo_url` was non-null and non-empty in **all 2,259** sampled features
  (2021 → 2026). A nullable `photo_url` could not be evidenced. The schema may still want to
  tolerate null defensively, but there is no fixture for it and no evidence it occurs.
- **A null `description`** — likewise **0/2259** null and 0/2259 empty string. The closest real case
  is `2026-99779A`, whose `description` is 2 characters, which is the practical equivalent for
  rendering purposes.

---

## 14. Unverified / open questions

Everything below is **not established**. Do not encode any of it as fact.

1. **Terms of use / redistribution licence.** Unresolved and blocking for production (§11). Needs a
   human to contact NECTEC/BMA.
2. **Rate limits.** No documentation, no headers, none hit during investigation. Unknown.
3. **Error-response shape.** Every request in this session returned `status: "success"` with
   `message: ""`. I never saw a failure, so the shape of a non-success body — and whether it still
   returns HTTP 200 — is unknown. The zod schema must not assume `features` is present.
4. **`problem_type` filter semantics.** Unknown whether it is "array contains" or "exact
   single-tag match". Every item in the verification probe had exactly one tag (§6).
5. **Whether `start` or `end` works alone.** Only tested as a pair.
6. **Other `sort` values.** Only `sort=asc` was tested. `desc` is the default but was not tested
   explicitly, and no other sort key was tried.
7. **`offset` behaviour past the dataset end**, and whether deep offsets stay consistent while new
   tickets arrive at the head. Near-certainly they shift — paging with `offset` during active
   ingest will skip/duplicate. Prefer a `message_id` or `timestamp` high-water mark.
8. **`total` semantics when only non-filter params are present.** Empirically `0`; whether that is
   intentional or a bug is unknown (§3.4).
9. **`see_info` (boolean)** — meaning unknown. Possibly a public-visibility flag. 4/1000 were
   `false`. Do not gate display on it without confirming.
10. **`total_point`** — meaning unknown.
11. **`star`**, **`problem_type_abdul`**, **`description_reporter`** — always null across 2,259
    features. Types and meanings unknown.
12. **`ai.sentimental_percent`** — 0–100, but not obviously "sentiment". A value of 90 accompanied a
    neutral, factual complaint. Do not display or threshold it.
13. **`duration_minutes_total`** — still unresolved, though narrowed. It equals
    `duration_minutes_finished` on 877 of 886 finished tickets but diverges on 9, and 589
    *unfinished* tickets carry a value that matches neither `timestamp → last_activity` nor
    `timestamp → now`. (Its siblings `duration_minutes_inprogress` and `duration_minutes_finished`
    *were* resolved exactly — see §5.) Do not use this field; compute elapsed time from timestamps.
14. **`org` vs `org_action`** — same value universe, different order in every sample. Whether their
    *membership* ever differs was not established.
15. **`problemtype_photo` base URL.** It is a relative path; the base was not verified (plausibly
    the same `traffy_public_bucket`, but untested).
16. **The empty-string `state_type`.** `sum_state` reports 17 such records; none were sampled, so
    the matching `state` label is unknown.
17. **Whether `geometry.type` is always `Point`.** 2259/2259 were, but nothing guarantees it.
18. **Coordinate precision / snapping.** Not analysed. Whether Traffy rounds or snaps coordinates,
    and how that interacts with our H3 snapping (`src/lib/geo/`), is unknown.
19. **Whether tickets are ever deleted or `ticket_id`s reused.** Not testable in one session.
20. **`/share/teamchadchart/search`** (§12) — only two probes. Field set, pagination and
    relationship to the GeoJSON records all uninvestigated.
