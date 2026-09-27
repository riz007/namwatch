import { isAuthorisedInternal } from "@/lib/api/internal-auth.ts";
import { apiError } from "@/lib/api/respond.ts";
import { isDatabaseConfigured } from "@/lib/db/index.ts";
import { pruneOldReadings } from "@/lib/db/queries/ingest.ts";
import {
  clearOldIdentifiers,
  expireOverdueReports,
  pruneRateLimits,
  pruneVotesForExpiredReports,
} from "@/lib/db/queries/reports.ts";
import { NextResponse } from "next/server";

/**
 * `POST /api/internal/maintain` — expiry, roll-ups and retention.
 * Run nightly.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY_MS = 86_400_000;

export async function POST(request: Request) {
  if (!isAuthorisedInternal(request)) return apiError("unauthorised");
  if (!isDatabaseConfigured())
    return apiError("unavailable", { detail: "DATABASE_URL is not set" });

  const now = new Date();

  const expired = await expireOverdueReports(now);
  // Raw readings are kept for 14 days.
  const readingsPruned = await pruneOldReadings(
    new Date(now.getTime() - 14 * DAY_MS),
  );
  // Device and IP hashes are kept 7 days, for rate limiting only. This is the
  // window the privacy notice states, so it must not drift from that copy.
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  const identifiersCleared = await clearOldIdentifiers(sevenDaysAgo);
  const votesPruned = await pruneVotesForExpiredReports(sevenDaysAgo);
  await pruneRateLimits(new Date(now.getTime() - DAY_MS));

  return NextResponse.json(
    {
      ok: true,
      at: now.toISOString(),
      expired,
      readingsPruned,
      identifiersCleared,
      votesPruned,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
