# Design brief — NamWatch (เฝ้าน้ำ)

Brief for the Hallmark first-screen build. Derived from SPEC §8 (UX) and §10
(design system). After the owner approves the first screen, run "lock the
system" so Hallmark writes `DESIGN.md`, which then governs every later screen.

---

## What this is

A bilingual (Thai / English) flood situational-awareness web app for Bangkok.
It puts official water-level sensors and community flood reports on one map.

**People use it during an active disaster**, usually on a phone, often on a weak
mobile connection, sometimes one-handed in the rain, sometimes at night during a
power cut. They are trying to answer one question:

> *"Can I get through this road right now, and is my area getting worse?"*

## Who is looking at it

| Who | Reading it for | In what state |
|---|---|---|
| Commuter (Thai, mobile) | Is my route passable by motorbike or car? | In a hurry, one hand free |
| Canal-side resident | Is the canal near me rising? Should I move things upstairs? | Anxious, checking repeatedly |
| Expat / tourist (English) | What is going on and what do I do? | No local context at all |
| Volunteer / community lead | Where are the "need help" reports? | Scanning, comparing |

## Tone

Civic utility. Calm, trustworthy, information-dense but not cluttered.

This is closer to a transit departure board or a weather service than to a
product. **Avoid startup-landing-page aesthetics entirely**: no hero section, no
gradient mesh, no marketing copy, no illustration of a smiling person, no
"Get started". The first screen is the map and the data.

Severity is carried by the depth scale, not by making the whole UI red. A person
checking a dry street should not feel alarmed by the interface.

---

## Non-negotiables

These override any theme decision. They come from SPEC §10 and the safety rules
in AGENTS.md. If a design need collides with one of these, the design changes.

### 1. The depth-band colours are defined by the spec, not by the theme

`depth-0` … `depth-5` are **semantic tokens already fixed** in
`src/config/depth-bands.ts` and generated into `src/styles/depth-tokens.css`.
They are a colour-blind-safe sequential ramp, validated by `pnpm check:cvd`
against simulated protanopia, deuteranopia and tritanopia, and calibrated to
beat ColorBrewer's reference hazard palettes.

**Do not restyle, re-derive, or "harmonise" these with the theme palette.**
Build the rest of the palette so it sits comfortably beside them — they are the
fixed point, and the neutrals and accent should be chosen to agree with them.

| Token | Meaning | Light | Dark |
|---|---|---|---|
| `depth-0` | Dry / receded | `#356C6D` | `#5FBCBE` |
| `depth-1` | Puddles, below ankle | `#FCE3A6` | `#FEF0C6`* |
| `depth-2` | Shin-deep, 10–30 cm | `#DEAE34` | `#FBB42D`* |
| `depth-3` | Knee-deep, 30–50 cm | `#B47B24` | `#F17B20`* |
| `depth-4` | Waist-deep, 50–100 cm | `#8E4714` | `#ED3A15`* |
| `depth-5` | Chest-deep or higher | `#66110E` | `#C0212D`* |

\* the committed dark values are the authority — read them from
`src/styles/depth-tokens.css`, never retype them.

Each band also has an `-on` (text) and a `-border` token. The border is what
carries WCAG non-text contrast for the pale bands, so **always render it**.

### 2. Severity is never colour alone

Every depth indication must show **colour + pictogram + text label** together
(WCAG 2.2 AA, SPEC §8.1). A legend that is only swatches is not acceptable.
Six pictograms are needed: dry, ankle, shin, knee, waist, chest — a simple
body-height or vehicle-height metaphor, legible at 16 px.

### 3. Thai typography

- Body face must render Thai correctly. Currently **IBM Plex Sans Thai**, paired
  with **IBM Plex Sans** for Latin (matched x-height). Hallmark may propose a
  display face, but the body face must stay Thai-capable.
- **Thai body line-height ≥ 1.6.** Stacked vowels and tone marks clip at tight
  leading. Headings may go to 1.45, no tighter.
- **Never apply letter-spacing to Thai.** It breaks cluster shaping. This is
  enforced globally in `globals.css` and must not be overridden.
- Thai text runs longer than English for the same content. Every component has
  to survive a Thai string roughly 1.3× the English length without truncating.
  Never truncate Thai by character count.

### 4. The emergency bar and the source/freshness labels cannot be made quiet

- The **emergency hotline bar** is on every public page, in both languages
  (Hard rule 1). It may be a collapsed chip, but it must be legible and
  reachable at the top of every screen. It cannot be styled into the background.
- Every datum shows its **source** and its **relative age** ("12 นาทีที่แล้ว" /
  "12 min ago"). These are first-class content, not fine print. They need a real
  type size and real contrast — not 10 px grey.
- **Official and community data must look clearly different.** There are three
  provenance levels and they need three visually distinct treatments:
  `official_sensor` (government gauge), `official_channel` (filed via Traffy
  Fondue — citizen-reported, agency-tracked), `crowd` (our own reports,
  unverified). Distinguish them by **shape**, not only by colour — colour is
  already fully spent on the depth scale.

### 5. Dark mode is required

Many people check at night during outages, on battery. Dark mode is a first-class
theme through tokens, not ad-hoc overrides.

### 6. Reach and touch

- **Design at 360 px wide first.** Not 390, not 414.
- Touch targets **≥ 48 px**. Primary actions sit in the **bottom thumb zone**.
- WCAG 2.2 AA throughout; AAA for the severity labels.
- The **List view is a peer of the Map view**, not a hidden fallback — it is what
  people on cheap phones without working WebGL actually use.

---

## The first screen

**Route `/[locale]` — Map + List.**

Must contain:

1. **Emergency bar** — collapsed chip, expands to four tap-to-call numbers.
2. **Header** — app name, Help link, language switch shown as "ไทย | EN"
   (never flags), always visible.
3. **Map ⇄ List toggle** — equal visual weight. Neither is the "real" one.
4. **The map** — MapLibre + OpenFreeMap vector tiles. Markers for: community
   reports (clustered), government sensor stations, Traffy items.
5. **Filter chips** — depth ≥ N, report type, and a time window (1 h / 3 h / 12 h).
6. **Primary action** — a floating "แจ้งน้ำท่วม / Report flood" button in the
   bottom thumb zone.
7. **A source/freshness strip** — attribution plus a "source delayed" state.

States that must be designed, not left to chance:

- **No data** in the current viewport
- **Stale data** — a source has not updated within 3× its cadence
- **Error** — a layer failed to load (the rest of the map must still work)
- **Loading** — on a slow connection this is what people see for several seconds
- **Offline** — showing last-known data

## Deliberately out of scope for this screen

Photos, district pages, the admin queue, rain radar, and the report form itself
are later screens. Design the system so they fit, but do not build them here.

## Reference points, for calibration

Think: a national weather service, a metro status board, a well-made
government service page. Not: a SaaS dashboard, a crypto app, a travel startup.
