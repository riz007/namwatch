import "server-only";

import { sql } from "drizzle-orm";
import { db, isDatabaseConfigured } from "../index.ts";
import { sourceHealth } from "../schema.ts";

export type SourceHealthRow = {
  readonly source: string;
  readonly lastSuccessAt: Date | null;
  readonly lastError: string | null;
  readonly updatedAt: Date;
};

export async function readSourceHealth(): Promise<readonly SourceHealthRow[]> {
  return db().select().from(sourceHealth);
}

export async function recordSourceSuccess(
  source: string,
  at: Date,
): Promise<void> {
  await db()
    .insert(sourceHealth)
    .values({ source, lastSuccessAt: at, lastError: null, updatedAt: at })
    .onConflictDoUpdate({
      target: sourceHealth.source,
      set: { lastSuccessAt: at, lastError: null, updatedAt: at },
    });
}

export async function recordSourceFailure(
  source: string,
  error: string,
  at: Date,
): Promise<void> {
  // LastSuccessAt is deliberately left alone: the UI needs to know how old the
  // last *good* data is, which is what the "source delayed" badge keys off.
  await db()
    .insert(sourceHealth)
    .values({ source, lastSuccessAt: null, lastError: error, updatedAt: at })
    .onConflictDoUpdate({
      target: sourceHealth.source,
      set: { lastError: error, updatedAt: at },
    });
}

/** `/api/v1/health`: a cheap liveness probe, not a full query. */
export async function pingDatabase(): Promise<{
  ok: boolean;
  latencyMs: number | null;
}> {
  if (!isDatabaseConfigured()) return { ok: false, latencyMs: null };
  const started = Date.now();
  try {
    await db().execute(sql`select 1`);
    return { ok: true, latencyMs: Date.now() - started };
  } catch {
    return { ok: false, latencyMs: null };
  }
}

/**
 * When each source last produced data, regardless of any time-window filter.
 *
 * The map filters by recency, so a stalled ingest makes the map look empty
 * rather than stale — which reads as "no flooding" instead of "no data". This
 * is what lets the UI tell the difference.
 */
export async function readFreshness(): Promise<{
  newestAt: Date | null;
  staleSources: string[];
}> {
  const rows = await readSourceHealth();
  const times = rows
    .map((r) => r.lastSuccessAt)
    .filter((d): d is Date => d !== null);
  const newestAt =
    times.length > 0
      ? new Date(Math.max(...times.map((d) => d.getTime())))
      : null;
  const now = Date.now();
  const staleSources = rows
    .filter(
      (r) =>
        !r.lastSuccessAt || now - r.lastSuccessAt.getTime() > STALE_AFTER_MS,
    )
    .map((r) => r.source);
  return { newestAt, staleSources };
}

/** Three times the fastest source cadence, matching the per-datum delayed badge. */
const STALE_AFTER_MS = 30 * 60_000;
