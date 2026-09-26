import type {
  IngestPayload,
  NormalizedReading,
  NormalizedStation,
  ReadingStatus,
} from '../types.ts';
import {
  rainPayloadSchema,
  waterLevelPayloadSchema,
  type RainReading,
  type WaterLevelReading,
} from './schema.ts';

/**
 * Normalisation for `thaiwater`. See `docs/sources/thaiwater.md` for the
 * verified contract behind every decision here.
 *
 * Hard rule 14: water level is metres MSL, rain is millimetres.
 */

/**
 * A reading older than this is reported as `unknown` rather than as a severity.
 *
 * This is a safety decision, not a tidiness one. The upstream payload silently
 * mixes fresh and days-old readings: station BKC004 was observed carrying a
 * 43-hour-old reading while still reporting `situation_level: 5`. Showing a
 * two-day-old measurement as "overbank" on a live flood map would be worse than
 * showing nothing. HII grey out stale stations on their own site for the same
 * reason (`scale.data.not_today`).
 */
export const STALE_READING_HOURS = 3;

/** Thailand has not observed DST since 1976, so the offset is a constant +07:00. */
const BANGKOK_OFFSET = '+07:00';

/**
 * Upstream datetimes are `"YYYY-MM-DD HH:MM"` wall-clock in Asia/Bangkok with no
 * zone marker. `new Date(...)` on that string uses the runtime's zone, which on
 * Vercel is UTC — silently shifting every reading by seven hours. The offset is
 * therefore always attached explicitly.
 */
export function parseBangkokTimestamp(value: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[1]}T${match[2]}:${match[3] ?? '00'}${BANGKOK_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Upstream mixes numeric strings and numbers. */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

const text = (v: string | null | undefined): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

/**
 * Whether a station's bank geometry can be trusted.
 *
 * Six stations publish `min_bank == 0` alongside `ground_level == 0`, which
 * produces nonsense downstream — station 558658 reports 279.23 m "over bank".
 * HII themselves omit the derived fields for these. Treat the bank as unknown.
 */
export function hasUsableBank(minBank: number | null, groundLevel: number | null): boolean {
  if (minBank === null) return false;
  if (minBank === 0 && (groundLevel === null || groundLevel === 0)) return false;
  if (groundLevel !== null && minBank === groundLevel) return false;
  return true;
}

/**
 * Our severity, derived from freeboard against the bank — deliberately NOT from
 * `situation_level`, which measures how full the channel is from bed to bank and
 * so reads 4 for a station sitting 1.8 m below its bank (docs §4).
 *
 * The `>=` at the top matches HII's own labelling: they call a level exactly
 * equal to the bank ล้นตลิ่ง, and disagreeing with the official site would be
 * confusing during an emergency.
 */
export function deriveStatus(
  levelMsl: number | null,
  minBank: number | null,
  groundLevel: number | null,
  observedAt: Date | null,
  now: Date,
): ReadingStatus {
  if (levelMsl === null || observedAt === null) return 'unknown';

  const ageHours = (now.getTime() - observedAt.getTime()) / 3_600_000;
  if (ageHours > STALE_READING_HOURS) return 'unknown';

  if (!hasUsableBank(minBank, groundLevel)) return 'unknown';

  const freeboard = levelMsl - (minBank as number);
  if (freeboard >= 0) return 'critical';
  if (freeboard >= -0.3) return 'warning';
  if (freeboard >= -1.0) return 'watch';
  return 'normal';
}

/**
 * A site can host both a water-level gauge and a rain gauge under the SAME
 * `station.id`, but they are different sensors measuring different quantities
 * in different units. SPEC §11 makes `(source, external_id)` unique, so the
 * feed is folded into the id to keep them distinct rows.
 */
const externalIdFor = (stationId: number, kind: NormalizedStation['kind']): string =>
  `${kind === 'rain' ? 'rain' : 'wl'}:${stationId}`;

function stationFrom(
  reading: WaterLevelReading | RainReading,
  kind: NormalizedStation['kind'],
): NormalizedStation | null {
  const s = reading.station;
  const lon = toNumber(s.tele_station_long);
  const lat = toNumber(s.tele_station_lat);
  // A station with no coordinates cannot go on a map; skip rather than guess.
  if (lon === null || lat === null || (lon === 0 && lat === 0)) return null;

  const minBank = toNumber(s.min_bank);
  const groundLevel = toNumber(s.ground_level);
  const usableBank = hasUsableBank(minBank, groundLevel);

  return {
    source: 'thaiwater',
    externalId: externalIdFor(s.id, kind),
    kind,
    nameTh: text(s.tele_station_name?.th),
    nameEn: text(s.tele_station_name?.en),
    point: { lon, lat },
    districtTh: text(reading.geocode?.amphoe_name?.th),
    bankLevelM: usableBank ? minBank : null,
    groundLevelM: groundLevel,
    meta: {
      oldCode: s.tele_station_oldcode ?? null,
      agencyTh: reading.agency?.agency_shortname?.th ?? null,
      agencyEn: reading.agency?.agency_shortname?.en ?? null,
      provinceTh: reading.geocode?.province_name?.th ?? null,
      provinceEn: reading.geocode?.province_name?.en ?? null,
      // Kept raw and unused for severity — see docs §4.
      situationLevel: 'situation_level' in reading ? (reading.situation_level ?? null) : null,
      bankGeometryUsable: usableBank,
    },
  };
}

export function normalizeWaterLevel(raw: unknown, now: Date = new Date()): IngestPayload {
  const parsed = waterLevelPayloadSchema.parse(raw);
  const stations: NormalizedStation[] = [];
  const readings: NormalizedReading[] = [];

  for (const item of parsed.waterlevel_data.data) {
    // Canals and rivers are not distinguished by the feed; `river_name` exists
    // on some items but is unreliable, so everything is a canal/river level and
    // the distinction is left to the UI, which shows the station name anyway.
    const station = stationFrom(item, 'canal_level');
    if (!station) continue;

    const observedAt = parseBangkokTimestamp(item.waterlevel_datetime);
    const levelMsl = toNumber(item.waterlevel_msl);

    stations.push(station);

    if (observedAt !== null && levelMsl !== null) {
      readings.push({
        source: 'thaiwater',
        externalId: station.externalId,
        observedAt,
        // Hard rule 14: metres MSL.
        value: levelMsl,
        status: deriveStatus(
          levelMsl,
          toNumber(item.station.min_bank),
          toNumber(item.station.ground_level),
          observedAt,
          now,
        ),
      });
    }
  }

  return { stations, readings, externalReports: [] };
}

export function normalizeRain(raw: unknown): IngestPayload {
  const parsed = rainPayloadSchema.parse(raw);
  const stations: NormalizedStation[] = [];
  const readings: NormalizedReading[] = [];

  for (const item of parsed.data) {
    const station = stationFrom(item, 'rain');
    if (!station) continue;

    const observedAt = parseBangkokTimestamp(item.rainfall_datetime);
    const mm = toNumber(item.rain_24h);

    stations.push(station);

    if (observedAt !== null && mm !== null) {
      readings.push({
        source: 'thaiwater',
        externalId: station.externalId,
        observedAt,
        // Hard rule 14: millimetres.
        value: mm,
        // Rainfall has no bank to compare against; severity is not ours to invent.
        status: 'unknown',
      });
    }
  }

  return { stations, readings, externalReports: [] };
}

/** Merges the two feeds, de-duplicating stations that appear in both. */
export function mergePayloads(...payloads: readonly IngestPayload[]): IngestPayload {
  const stations = new Map<string, NormalizedStation>();
  const readings = new Map<string, NormalizedReading>();

  for (const p of payloads) {
    for (const s of p.stations) stations.set(`${s.source}:${s.externalId}`, s);
    // Dedupe on (station, observed_at) — the upstream row id is per-reading and
    // changes whenever telemetry lands, so it is not a stable key (docs §5).
    for (const r of p.readings) {
      readings.set(`${r.source}:${r.externalId}:${r.observedAt.toISOString()}`, r);
    }
  }

  return {
    stations: [...stations.values()],
    readings: [...readings.values()],
    externalReports: [],
  };
}
