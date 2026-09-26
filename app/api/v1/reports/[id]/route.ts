import { NextResponse } from 'next/server';
import { apiError, CACHE } from '@/lib/api/respond.ts';
import { reportIdSchema } from '@/lib/api/schemas.ts';
import { findPublicReport } from '@/lib/db/queries/reports.ts';
import { floodingStationsNear } from '@/lib/db/queries/map.ts';
import { isDatabaseConfigured } from '@/lib/db/index.ts';
import { decayOpacity, type ReportKind } from '@/lib/reports/decay.ts';
import { isCorroborated } from '@/lib/reports/trust.ts';
import { CORROBORATION_RADIUS_M } from '@/config/app.config.ts';

/**
 * `GET /api/v1/reports/:id` — public fields only, `s-maxage=15`.
 * The response is built from `geom_public`.
 */
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!reportIdSchema.safeParse(id).success) return apiError('not_found');
  if (!isDatabaseConfigured()) return apiError('unavailable');

  const report = await findPublicReport(id);
  if (!report) return apiError('not_found');

  // Corroboration badge. Computed server-side against the public
  // point, which is close enough for a 500 m radius and leaks nothing.
  const nearby = await floodingStationsNear(report.lon, report.lat, CORROBORATION_RADIUS_M).catch(
    () => [],
  );
  const corroborated = isCorroborated(
    { lon: report.lon, lat: report.lat },
    nearby.map((s) => ({
      point: { lon: s.lon, lat: s.lat },
      status: s.status as 'warning' | 'critical',
    })),
  );

  const now = new Date();
  return NextResponse.json(
    {
      ...report,
      createdAt: report.createdAt.toISOString(),
      expiresAt: report.expiresAt.toISOString(),
      opacity: decayOpacity(report.createdAt, report.kind as ReportKind, now),
      corroborated,
      provenance: 'crowd',
    },
    { headers: { 'cache-control': CACHE.report } },
  );
}
