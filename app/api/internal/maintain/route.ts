import { NextResponse } from 'next/server';
import { isAuthorisedInternal } from '@/lib/api/internal-auth.ts';
import { apiError } from '@/lib/api/respond.ts';
import { clearOldIpHashes, expireOverdueReports, pruneRateLimits } from '@/lib/db/queries/reports.ts';
import { pruneOldReadings } from '@/lib/db/queries/ingest.ts';
import { isDatabaseConfigured } from '@/lib/db/index.ts';

/**
 * `POST /api/internal/maintain` — expiry, roll-ups and retention.
 * Run nightly.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DAY_MS = 86_400_000;

export async function POST(request: Request) {
  if (!isAuthorisedInternal(request)) return apiError('unauthorised');
  if (!isDatabaseConfigured()) return apiError('unavailable', { detail: 'DATABASE_URL is not set' });

  const now = new Date();

  const expired = await expireOverdueReports(now);
  // Raw readings are kept for 14 days.
  const readingsPruned = await pruneOldReadings(new Date(now.getTime() - 14 * DAY_MS));
  // IP hashes are kept 7 days, for rate limiting only.
  const ipHashesCleared = await clearOldIpHashes(new Date(now.getTime() - 7 * DAY_MS));
  await pruneRateLimits(new Date(now.getTime() - DAY_MS));

  return NextResponse.json(
    { ok: true, at: now.toISOString(), expired, readingsPruned, ipHashesCleared },
    { headers: { 'cache-control': 'no-store' } },
  );
}
