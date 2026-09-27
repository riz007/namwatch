import type { IngestPayload, NormalizedExternalReport } from "../types.ts";
import { traffyPayloadSchema, type TraffyFeature } from "./schema.ts";

/**
 * Provenance is `official_channel`: citizen-reported but tracked in the official
 * BMA queue — never present it as a sensor reading, nor as our own crowd data.
 */

/**
 * Flood tags. `อุทกภัย` always co-occurs with `น้ำท่วม` in the observed data but
 * is included for safety. Deliberately an exact match: substring-matching on
 * `น้ำ` ("water") would also catch `ประปา` (tap water), which is not flooding.
 */
const FLOOD_TAGS = new Set(["น้ำท่วม", "อุทกภัย"]);

export const isFloodTagged = (
  tags: readonly string[] | null | undefined,
): boolean => Array.isArray(tags) && tags.some((t) => FLOOD_TAGS.has(t.trim()));

/**
 * Traffy timestamps are `"YYYY-MM-DD HH:MM:SS"` wall-clock in Asia/Bangkok with
 * no zone marker — the same trap as ThaiWater. Always attach the offset.
 */
const BANGKOK_OFFSET = "+07:00";

export function parseTraffyTimestamp(
  value: string | null | undefined,
): Date | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?/.exec(
    value.trim(),
  );
  if (!match) return null;
  const date = new Date(
    `${match[1]}T${match[2]}:${match[3] ?? "00"}${BANGKOK_OFFSET}`,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Strips personal information citizens put in free-text complaints: live mobile
 * numbers, house numbers, and `โทร`/`ติดต่อ` blocks. The data is already public
 * upstream, but concentrating it on our map under our byline changes the exposure.
 */
export function scrubPii(text: string): string {
  return (
    text
      // Thai mobile/landline runs, with or without separators.
      .replace(/\b0\d[\d\s-]{7,12}\d\b/g, "[เบอร์โทร]")
      // No \b before "+": it is a non-word character, so the boundary can never match.
      .replace(/\+ ?66[\d\s-]{7,13}\d/g, "[เบอร์โทร]")
      // The structured intake block's house-number line.
      .replace(/บ้านเลขที่\s*:?\s*[\d/\-–]+/g, "บ้านเลขที่ [ตัดออก]")
      // Explicit contact markers followed by digits.
      .replace(/(โทร|เบอร์|ติดต่อ)\s*:?\s*[\d\s()+-]{6,}/g, "$1 [ตัดออก]")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
  );
}

/**
 * Prefers the upstream summary, which is already abstracted and carries no
 * personal detail; falls back to a scrubbed description. Upstream's inferred
 * categories are not used — they are a guess, not an agency classification.
 */
export function displayText(feature: TraffyFeature): string | null {
  const summary = feature.properties.ai?.summary?.trim();
  if (summary) return summary;

  const description = feature.properties.description?.trim();
  if (!description) return null;

  const scrubbed = scrubPii(description);
  return scrubbed === "" ? null : scrubbed;
}

/** Bangkok-ish bounds; a coordinate outside them is upstream noise. */
const inThailand = (lon: number, lat: number): boolean =>
  lon >= 96 && lon <= 106 && lat >= 5 && lat <= 21;

export function normalizeTraffy(raw: unknown): IngestPayload {
  const parsed = traffyPayloadSchema.parse(raw);
  const externalReports: NormalizedExternalReport[] = [];

  for (const feature of parsed.features) {
    const p = feature.properties;

    if (!isFloodTagged(p.problem_type_fondue)) continue;

    const coords = feature.geometry?.coordinates;
    if (!coords) continue;
    const [lon, lat] = coords;
    if (!inThailand(lon, lat)) continue;

    const observedAt = parseTraffyTimestamp(p.timestamp);
    if (!observedAt) continue;

    externalReports.push({
      source: "traffy",
      externalId: p.ticket_id,
      provenance: "official_channel",
      kind: "flood",
      point: { lon, lat },
      districtTh: p.district?.trim() || null,
      // Kept verbatim: reinterpreting an agency's workflow state would be
      // reporting something they did not say.
      state: p.state?.trim() || null,
      description: displayText(feature),
      url: `https://share.traffy.in.th/teamchadchart?ticketID=${encodeURIComponent(p.ticket_id)}`,
      photoUrl: p.photo_url?.trim() || null,
      observedAt,
      meta: {
        messageId: p.message_id ?? null,
        stateType: p.state_type_latest ?? null,
        subdistrictTh: p.subdistrict ?? null,
        provinceTh: p.province ?? null,
        tags: p.problem_type_fondue ?? [],
        lastActivity:
          parseTraffyTimestamp(p.last_activity)?.toISOString() ?? null,
      },
    });
  }

  return { stations: [], readings: [], externalReports };
}
