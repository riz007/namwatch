import { CACHE } from "@/lib/api/respond.ts";
import { isDatabaseConfigured } from "@/lib/db/index.ts";
import { pingDatabase, readSourceHealth } from "@/lib/db/queries/health.ts";
import { ADAPTERS, isStale } from "@/lib/sources/registry.ts";
import { NextResponse } from "next/server";

/**
 * `GET /api/v1/health` — source health plus a DB ping. `no-store`.
 *
 * Always answers 200 with a body describing what is degraded, rather than
 * failing: a health endpoint that 500s tells a monitor less than one that
 * explains which layer is down.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const database = await pingDatabase();

  let sources: {
    id: string;
    ok: boolean;
    lastSuccessAt: string | null;
    stale: boolean;
    lastError: string | null;
  }[];

  if (database.ok) {
    const rows = await readSourceHealth();
    const byId = new Map(rows.map((r) => [r.source, r]));
    sources = ADAPTERS.map((a) => {
      const row = byId.get(a.id);
      const lastSuccessAt = row?.lastSuccessAt ?? null;
      return {
        id: a.id,
        ok: Boolean(lastSuccessAt) && !row?.lastError,
        lastSuccessAt: lastSuccessAt?.toISOString() ?? null,
        stale: isStale(a, lastSuccessAt),
        lastError: row?.lastError ?? null,
      };
    });
  } else {
    // In spirit: report the degradation, do not throw.
    sources = ADAPTERS.map((a) => ({
      id: a.id,
      ok: false,
      lastSuccessAt: null,
      stale: true,
      lastError: "source health unavailable while the database is unreachable",
    }));
  }

  return NextResponse.json(
    {
      ok: database.ok && sources.every((s) => !s.stale),
      database: { configured: isDatabaseConfigured(), ...database },
      sources,
      checkedAt: new Date().toISOString(),
    },
    { headers: { "cache-control": CACHE.none } },
  );
}
