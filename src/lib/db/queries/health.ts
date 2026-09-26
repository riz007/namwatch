import 'server-only';

import { sql } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '../index.ts';
import { sourceHealth } from '../schema.ts';

export type SourceHealthRow = {
  readonly source: string;
  readonly lastSuccessAt: Date | null;
  readonly lastError: string | null;
  readonly updatedAt: Date;
};

export async function readSourceHealth(): Promise<readonly SourceHealthRow[]> {
  return db().select().from(sourceHealth);
}

export async function recordSourceSuccess(source: string, at: Date): Promise<void> {
  await db()
    .insert(sourceHealth)
    .values({ source, lastSuccessAt: at, lastError: null, updatedAt: at })
    .onConflictDoUpdate({
      target: sourceHealth.source,
      set: { lastSuccessAt: at, lastError: null, updatedAt: at },
    });
}

export async function recordSourceFailure(source: string, error: string, at: Date): Promise<void> {
  // lastSuccessAt is deliberately left alone: the UI needs to know how old the
  // last *good* data is, which is what the "source delayed" badge keys off.
  await db()
    .insert(sourceHealth)
    .values({ source, lastSuccessAt: null, lastError: error, updatedAt: at })
    .onConflictDoUpdate({
      target: sourceHealth.source,
      set: { lastError: error, updatedAt: at },
    });
}

/** SPEC §12 `/api/v1/health`: a cheap liveness probe, not a full query. */
export async function pingDatabase(): Promise<{ ok: boolean; latencyMs: number | null }> {
  if (!isDatabaseConfigured()) return { ok: false, latencyMs: null };
  const started = Date.now();
  try {
    await db().execute(sql`select 1`);
    return { ok: true, latencyMs: Date.now() - started };
  } catch {
    return { ok: false, latencyMs: null };
  }
}
