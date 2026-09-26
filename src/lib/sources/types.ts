/**
 * The contract every source adapter implements..
 *
 * a failing adapter degrades only its own layer and never throws
 * into page render. `runAdapter` in `registry.ts` is what enforces that — an
 * adapter itself may throw, and the registry converts it into an unhealthy result.
 *
 * Adapters are written against a real captured sample. Tests run
 * against `fixtures/` only and never touch the network.
 *
 * Units are normalised here, not in the UI — water level in metres
 * MSL, road flood in cm, rain in mm — and documented in the source documentation.
 */
import type { Provenance } from '../db/schema.ts';

export type SourceId = 'thaiwater' | 'bma-dds' | 'traffy' | 'rainviewer' | 'gistda' | 'openmeteo';

export type StationKind = 'canal_level' | 'river_level' | 'road_flood' | 'rain';
export type ReadingStatus = 'normal' | 'watch' | 'warning' | 'critical' | 'unknown';

export type LonLat = { readonly lon: number; readonly lat: number };

export type NormalizedStation = {
  readonly source: SourceId;
  readonly externalId: string;
  readonly kind: StationKind;
  readonly nameTh: string | null;
  readonly nameEn: string | null;
  readonly point: LonLat;
  /** Thai district name as the upstream gives it, resolved to a region at ingest. */
  readonly districtTh: string | null;
  /** Metres MSL. */
  readonly bankLevelM: number | null;
  readonly groundLevelM: number | null;
  /** Raw upstream fields we deliberately do not interpret. */
  readonly meta: Record<string, unknown>;
};

export type NormalizedReading = {
  readonly source: SourceId;
  readonly externalId: string;
  readonly observedAt: Date;
  /** Unit is fixed by the station's `kind`. */
  readonly value: number;
  readonly status: ReadingStatus;
};

export type NormalizedExternalReport = {
  readonly source: SourceId;
  readonly externalId: string;
  readonly provenance: Provenance;
  readonly kind: string;
  readonly point: LonLat;
  readonly districtTh: string | null;
  /** Upstream workflow state, kept verbatim — never reinterpreted. */
  readonly state: string | null;
  readonly description: string | null;
  readonly url: string | null;
  readonly photoUrl: string | null;
  readonly observedAt: Date;
  readonly meta: Record<string, unknown>;
};

export type IngestPayload = {
  readonly stations: readonly NormalizedStation[];
  readonly readings: readonly NormalizedReading[];
  readonly externalReports: readonly NormalizedExternalReport[];
};

export const emptyPayload = (): IngestPayload => ({
  stations: [],
  readings: [],
  externalReports: [],
});

export type Attribution = {
  readonly nameTh: string;
  readonly nameEn: string;
  readonly url: string;
  /** Terms of use as understood at the time the source documentation was written. */
  readonly terms: string;
};

export type SourceAdapter = {
  readonly id: SourceId;
  readonly provenance: Provenance;
  /** Publish cadence in minutes. A source is "delayed" past 3× this. */
  readonly cadenceMinutes: number;
  readonly attribution: Attribution;
  /** Hits the network. Only called from the ingest route, never from render. */
  fetchRaw(signal?: AbortSignal): Promise<unknown>;
  /** Pure. Parses and normalises; throws on a payload it cannot trust. */
  normalize(raw: unknown): IngestPayload;
  /** The committed sample, for tests and `pnpm ingest:local`. */
  loadFixture(): unknown;
};

export type AdapterResult = {
  readonly id: SourceId;
  readonly ok: boolean;
  readonly payload: IngestPayload;
  readonly error: string | null;
  readonly durationMs: number;
};
