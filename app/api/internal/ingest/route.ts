import { NextResponse } from 'next/server';
import { isAuthorisedInternal } from '@/lib/api/internal-auth.ts';
import { apiError } from '@/lib/api/respond.ts';
import { ADAPTERS, adapterById, runAdapter } from '@/lib/sources/registry.ts';
import { persistPayload } from '@/lib/db/queries/ingest.ts';
import { recordSourceFailure, recordSourceSuccess } from '@/lib/db/queries/health.ts';
import { isDatabaseConfigured } from '@/lib/db/index.ts';
import { log } from '@/lib/log.ts';
import type { SourceId } from '@/lib/sources/types.ts';

/**
 * `POST /api/internal/ingest`. Header `x-ingest-secret`, runs all due
 * adapters. Driven by the GitHub Actions cron every 10 minutes.
 *
 * Each adapter is isolated: one failing upstream records its own error and
 * leaves every other layer's data intact.
 *
 * `?source=thaiwater` runs a single adapter, for debugging a specific feed.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isAuthorisedInternal(request)) return apiError('unauthorised');
  if (!isDatabaseConfigured()) return apiError('unavailable', { detail: 'DATABASE_URL is not set' });

  const requested = new URL(request.url).searchParams.get('source') as SourceId | null;
  const adapters = requested
    ? [adapterById(requested)].filter((a) => a !== undefined)
    : [...ADAPTERS];

  if (adapters.length === 0) {
    return apiError('invalid_request', { detail: `unknown source: ${requested}` });
  }

  const startedAt = new Date();
  const results = await Promise.all(
    adapters.map(async (adapter) => {
      const result = await runAdapter(adapter);
      const at = new Date();

      if (!result.ok) {
        await recordSourceFailure(adapter.id, result.error ?? 'unknown error', at).catch((e) =>
          log.error({ source: adapter.id, err: String(e) }, 'could not record source failure'),
        );
        return { source: adapter.id, ok: false, error: result.error, counts: null };
      }

      try {
        const counts = await persistPayload(result.payload);
        await recordSourceSuccess(adapter.id, at);
        return { source: adapter.id, ok: true, error: null, counts };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await recordSourceFailure(adapter.id, message, at).catch(() => {});
        log.error({ source: adapter.id, err: message }, 'persist failed');
        return { source: adapter.id, ok: false, error: message, counts: null };
      }
    }),
  );

  const ok = results.every((r) => r.ok);
  return NextResponse.json(
    {
      ok,
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      results,
    },
    // A partial failure is still a successful run of the endpoint; the body says
    // which layer degraded. 207 makes that visible to the cron without alarming.
    { status: ok ? 200 : 207, headers: { 'cache-control': 'no-store' } },
  );
}
