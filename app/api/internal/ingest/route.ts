import { isAuthorisedInternal } from "@/lib/api/internal-auth.ts";
import { apiError } from "@/lib/api/respond.ts";
import { isDatabaseConfigured } from "@/lib/db/index.ts";
import { runIngest, UnknownSourceError } from "@/lib/sources/run.ts";
import type { SourceId } from "@/lib/sources/types.ts";
import { NextResponse } from "next/server";

/**
 * `POST /api/internal/ingest`. Header `x-ingest-secret`, runs all due
 * adapters. Driven by the GitHub Actions cron.
 *
 * Each adapter is isolated: one failing upstream records its own error and
 * leaves every other layer's data intact.
 *
 * `?source=thaiwater` runs a single adapter, for debugging a specific feed.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isAuthorisedInternal(request)) return apiError("unauthorised");
  if (!isDatabaseConfigured())
    return apiError("unavailable", { detail: "DATABASE_URL is not set" });

  const requested = new URL(request.url).searchParams.get(
    "source",
  ) as SourceId | null;

  const startedAt = new Date();
  let outcome;
  try {
    outcome = await runIngest(requested);
  } catch (error) {
    if (error instanceof UnknownSourceError) {
      return apiError("invalid_request", { detail: error.message });
    }
    throw error;
  }

  return NextResponse.json(
    {
      ok: outcome.ok,
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      results: outcome.results,
    },
    // A partial failure is still a successful run of the endpoint; the body says
    // which layer degraded. 207 makes that visible to the cron without alarming.
    {
      status: outcome.ok ? 200 : 207,
      headers: { "cache-control": "no-store" },
    },
  );
}
