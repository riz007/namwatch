import { NextResponse } from 'next/server';
import { apiError, CACHE } from '@/lib/api/respond.ts';
import { mapQuerySchema } from '@/lib/api/schemas.ts';
import { InvalidBBoxError, parseBBox } from '@/lib/geo/bbox.ts';
import {
  externalReportsInBBox,
  reportsInBBox,
  stationsInBBox,
  type MapExternalReport,
  type MapReport,
  type MapStation,
} from '@/lib/db/queries/map.ts';
import { isDatabaseConfigured } from '@/lib/db/index.ts';
import { decayOpacity, type ReportKind } from '@/lib/reports/decay.ts';
import { log } from '@/lib/log.ts';

/**
 * SPEC §12 `GET /api/v1/map?bbox=&layers=&since=` — combined GeoJSON for the
 * viewport. `s-maxage=30, stale-while-revalidate=300`.
 *
 * Hard rule 5: each layer is fetched independently and a failure degrades only
 * that layer. The response always carries a `degraded` list so the UI can show
 * which layer is missing rather than silently showing less.
 *
 * Hard rule 10: report geometry comes from `geom_public`, never `geom_exact`.
 */
export const dynamic = 'force-dynamic';

type Feature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: Record<string, unknown>;
};

const ALL_LAYERS = ['reports', 'stations', 'external'] as const;
type Layer = (typeof ALL_LAYERS)[number];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = mapQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return apiError('invalid_request', { detail: parsed.error.issues[0]?.message });
  }

  let bbox;
  try {
    bbox = parseBBox(parsed.data.bbox);
  } catch (error) {
    if (error instanceof InvalidBBoxError) {
      return apiError('invalid_request', { detail: error.message });
    }
    throw error;
  }

  if (!isDatabaseConfigured()) {
    return apiError('unavailable', { detail: 'DATABASE_URL is not set' });
  }

  const requested: readonly Layer[] = parsed.data.layers
    ? (parsed.data.layers.split(',').filter((l): l is Layer =>
        (ALL_LAYERS as readonly string[]).includes(l),
      ) as Layer[])
    : ALL_LAYERS;

  const now = new Date();
  const since = new Date(now.getTime() - parsed.data.since * 3_600_000);
  const degraded: string[] = [];

  const layer = async <T,>(name: Layer, run: () => Promise<readonly T[]>): Promise<readonly T[]> => {
    if (!requested.includes(name)) return [];
    try {
      return await run();
    } catch (error) {
      // Hard rule 5: degrade this layer only.
      degraded.push(name);
      log.warn({ layer: name, err: String(error) }, 'map layer failed');
      return [];
    }
  };

  const [reports, stations, external] = await Promise.all([
    layer<MapReport>('reports', () => reportsInBBox(bbox, since, now)),
    layer<MapStation>('stations', () => stationsInBBox(bbox)),
    layer<MapExternalReport>('external', () => externalReportsInBBox(bbox, since)),
  ]);

  const features: Feature[] = [
    ...reports.map(
      (r): Feature => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
        properties: {
          layer: 'reports',
          provenance: 'crowd',
          id: r.id,
          kind: r.kind,
          depthBand: r.depthBand,
          note: r.note,
          createdAt: r.createdAt.toISOString(),
          expiresAt: r.expiresAt.toISOString(),
          opacity: decayOpacity(r.createdAt, r.kind as ReportKind, now),
          stillCount: r.stillCount,
          recededCount: r.recededCount,
          regionId: r.regionId,
        },
      }),
    ),
    ...stations.map(
      (s): Feature => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: {
          layer: 'stations',
          provenance: 'official_sensor',
          id: s.id,
          source: s.source,
          kind: s.kind,
          nameTh: s.nameTh,
          nameEn: s.nameEn,
          value: s.value === null ? null : Number(s.value),
          bankLevelM: s.bankLevelM === null ? null : Number(s.bankLevelM),
          status: s.status ?? 'unknown',
          observedAt: s.observedAt?.toISOString() ?? null,
        },
      }),
    ),
    ...external.map(
      (e): Feature => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [e.lon, e.lat] },
        properties: {
          layer: 'external',
          provenance: e.provenance,
          id: e.id,
          source: e.source,
          kind: e.kind,
          state: e.state,
          description: e.description,
          url: e.url,
          observedAt: e.observedAt.toISOString(),
          regionId: e.regionId,
        },
      }),
    ),
  ];

  return NextResponse.json(
    {
      type: 'FeatureCollection',
      features,
      meta: {
        bbox,
        sinceHours: parsed.data.since,
        generatedAt: now.toISOString(),
        counts: {
          reports: reports.length,
          stations: stations.length,
          external: external.length,
        },
        degraded,
      },
    },
    { headers: { 'cache-control': CACHE.map } },
  );
}
