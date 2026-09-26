import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { thaiwaterAdapter } from './adapter.ts';
import {
  deriveStatus,
  hasUsableBank,
  normalizeWaterLevel,
  parseBangkokTimestamp,
  STALE_READING_HOURS,
  toNumber,
} from './normalize.ts';

/**
 * Hard rule 12: tests run against committed fixtures only, never the network.
 * The fixtures are real upstream payloads captured on 26 Sep 2026.
 */
const readFixture = (name: string): unknown =>
  JSON.parse(readFileSync(`src/lib/sources/thaiwater/${name}`, 'utf8'));

const edgeCases = readFixture('fixtures/waterlevel-edge-cases.json');
/** Fixed clock just after the fixture was captured, so ages are deterministic. */
const NOW = new Date('2026-09-26T05:45:00Z'); // 12:45 Asia/Bangkok

describe('thaiwater timestamps', () => {
  // The single most dangerous bug available here: Vercel runs UTC, so a naive
  // parse shifts every reading by seven hours.
  it('parses wall-clock Bangkok time, not runtime-local time', () => {
    expect(parseBangkokTimestamp('2026-09-26 12:30')?.toISOString()).toBe(
      '2026-09-26T05:30:00.000Z',
    );
  });

  it('rejects unparseable timestamps instead of producing Invalid Date', () => {
    expect(parseBangkokTimestamp('not a date')).toBeNull();
    expect(parseBangkokTimestamp('')).toBeNull();
    expect(parseBangkokTimestamp('2026-13-45 99:99')).toBeNull();
  });
});

describe('thaiwater numeric coercion', () => {
  it('handles the mix of numeric strings and numbers upstream publishes', () => {
    expect(toNumber('350.52')).toBe(350.52);
    expect(toNumber(198.2)).toBe(198.2);
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber('')).toBeNull();
    expect(toNumber('n/a')).toBeNull();
  });
});

describe('thaiwater bank geometry', () => {
  // Station 558658 publishes min_bank 0 / ground_level 0 and a diff of 279.23 m.
  it('rejects the degenerate zero-bank geometry that produces nonsense freeboard', () => {
    expect(hasUsableBank(0, 0)).toBe(false);
    expect(hasUsableBank(0, null)).toBe(false);
    expect(hasUsableBank(2.2, 2.2)).toBe(false);
    expect(hasUsableBank(null, -0.33)).toBe(false);
    expect(hasUsableBank(2.2, -0.33)).toBe(true);
  });
});

describe('thaiwater severity derivation', () => {
  const fresh = new Date('2026-09-26T05:30:00Z');

  it('calls a level at or above the bank overbank, matching HII labelling', () => {
    expect(deriveStatus(2.82, 2.2, -0.33, fresh, NOW)).toBe('critical');
    expect(deriveStatus(2.2, 2.2, -0.33, fresh, NOW)).toBe('critical');
  });

  it('grades freeboard below the bank', () => {
    expect(deriveStatus(2.0, 2.2, -0.33, fresh, NOW)).toBe('warning');
    expect(deriveStatus(1.5, 2.2, -0.33, fresh, NOW)).toBe('watch');
    expect(deriveStatus(0.5, 2.2, -0.33, fresh, NOW)).toBe('normal');
  });

  // This is the safety case: the feed mixes in readings up to 43 h old and still
  // labels them with a severity. We must not repeat that.
  it('refuses to report a severity for a stale reading', () => {
    const stale = new Date(NOW.getTime() - (STALE_READING_HOURS + 1) * 3_600_000);
    expect(deriveStatus(2.82, 2.2, -0.33, stale, NOW)).toBe('unknown');
    const borderline = new Date(NOW.getTime() - (STALE_READING_HOURS - 0.1) * 3_600_000);
    expect(deriveStatus(2.82, 2.2, -0.33, borderline, NOW)).toBe('critical');
  });

  it('refuses to report a severity when the bank geometry is unusable', () => {
    expect(deriveStatus(279.23, 0, 0, fresh, NOW)).toBe('unknown');
    expect(deriveStatus(2.82, null, -0.33, fresh, NOW)).toBe('unknown');
  });

  // Freeboard needs only the bank; HII's channel-fill calculation also needs the
  // bed, so we can still grade stations where upstream omits situation_level.
  it('still grades a station that has a bank but no ground level', () => {
    expect(deriveStatus(7.5, 10.9, null, fresh, NOW)).toBe('normal');
    expect(hasUsableBank(10.9, null)).toBe(true);
  });

  // Documented in docs/sources/thaiwater.md §4: situation_level is channel fill,
  // not freeboard. Chao Phraya 15 is level 4 while 1.82 m BELOW its bank.
  it('does not inherit situation_level, which measures channel fill not flood risk', () => {
    expect(deriveStatus(0.34, 2.16, -15.697, fresh, NOW)).toBe('normal');
  });
});

describe('thaiwater normalisation against real fixtures', () => {
  const payload = normalizeWaterLevel(edgeCases, NOW);

  it('normalises every usable reading', () => {
    expect(payload.stations.length).toBeGreaterThan(0);
    expect(payload.readings.length).toBeGreaterThan(0);
  });

  it('keys stations on station.id (per feed), not the per-reading row id', () => {
    // docs §5: the top-level `id` changes whenever telemetry lands.
    const ids = payload.stations.map((s) => s.externalId);
    expect(ids).toContain('wl:1394808');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tolerates an absent English station name rather than failing the payload', () => {
    const anonymous = payload.stations.filter((s) => s.nameEn === null);
    expect(anonymous.length).toBeGreaterThan(0);
    for (const s of anonymous) expect(s.nameTh).not.toBe('');
  });

  it('drops the bank level for stations with degenerate geometry', () => {
    const degenerate = payload.stations.find((s) => s.externalId === 'wl:558658');
    expect(degenerate?.bankLevelM).toBeNull();
    expect(degenerate?.meta['bankGeometryUsable']).toBe(false);
  });

  it('keeps situation_level in meta but never as a status', () => {
    const chaoPhraya = payload.stations.find((s) => s.externalId === 'wl:4');
    expect(chaoPhraya?.meta['situationLevel']).toBe(4);
    const reading = payload.readings.find((r) => r.externalId === 'wl:4');
    expect(reading?.status).toBe('normal');
  });

  it('reports the live overbank canal correctly', () => {
    // Klong Ladprao at Bang Bua Temple: 2.82 m MSL against a 2.2 m bank.
    const reading = payload.readings.find((r) => r.externalId === 'wl:1');
    expect(reading?.value).toBeCloseTo(2.82, 2);
    expect(reading?.status).toBe('critical');
  });

  it('records water level in metres MSL (Hard rule 14)', () => {
    for (const r of payload.readings) {
      expect(r.value).toBeGreaterThan(-100);
      expect(r.value).toBeLessThan(1000);
    }
  });
});

describe('thaiwater adapter', () => {
  it('declares its provenance and cadence', () => {
    expect(thaiwaterAdapter.provenance).toBe('official_sensor');
    expect(thaiwaterAdapter.cadenceMinutes).toBe(10);
    expect(thaiwaterAdapter.attribution.nameTh).toContain('สถาบันสารสนเทศทรัพยากรน้ำ');
  });

  it('normalises its own fixture end to end', () => {
    const payload = thaiwaterAdapter.normalize(thaiwaterAdapter.loadFixture());
    expect(payload.stations.length).toBeGreaterThan(20);
    expect(payload.readings.length).toBeGreaterThan(20);
    expect(payload.externalReports).toEqual([]);

    // Both feeds present: canal levels and rain gauges.
    const kinds = new Set(payload.stations.map((s) => s.kind));
    expect(kinds).toContain('canal_level');
    expect(kinds).toContain('rain');
  });

  it('never emits a station without coordinates', () => {
    const payload = thaiwaterAdapter.normalize(thaiwaterAdapter.loadFixture());
    for (const s of payload.stations) {
      expect(Number.isFinite(s.point.lon)).toBe(true);
      expect(Number.isFinite(s.point.lat)).toBe(true);
      expect(s.point.lon).not.toBe(0);
    }
  });

  it('throws on a payload it cannot trust, so the registry can degrade the layer', () => {
    expect(() => thaiwaterAdapter.normalize({ waterLevel: { nope: true }, rain: null })).toThrow();
    expect(() => thaiwaterAdapter.normalize({ waterLevel: null, rain: null })).toThrow();
  });
});

describe('thaiwater station identity across feeds', () => {
  // A site can host both a water-level and a rain gauge under one station.id.
  // SPEC §11 makes (source, external_id) unique, so a collision here would make
  // the whole ingest batch fail on ON CONFLICT.
  it('never emits two stations with the same external id', () => {
    const payload = thaiwaterAdapter.normalize(thaiwaterAdapter.loadFixture());
    const ids = payload.stations.map((s) => s.externalId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('namespaces water-level and rain gauges separately', () => {
    const payload = thaiwaterAdapter.normalize(thaiwaterAdapter.loadFixture());
    expect(payload.stations.some((s) => s.externalId.startsWith('wl:'))).toBe(true);
    expect(payload.stations.some((s) => s.externalId.startsWith('rain:'))).toBe(true);
  });

  it('points every reading at a station it actually emitted', () => {
    const payload = thaiwaterAdapter.normalize(thaiwaterAdapter.loadFixture());
    const known = new Set(payload.stations.map((s) => s.externalId));
    for (const r of payload.readings) expect(known).toContain(r.externalId);
  });
});
