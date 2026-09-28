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
import { log } from "@/lib/log.ts";
import { NextResponse } from "next/server";

/**
 * `POST /api/internal/maintain` — expiry and retention. Run nightly.
 *
 * Every step runs and reports independently. One step throwing used to take
 * the whole request down as a bare 500 with an empty body, so the cron could
 * say only that "something" failed — and the steps that would have succeeded
 * never ran. Retention is a promise made to people in the privacy notice;
 * losing it to an unrelated failure, silently, is the worst outcome here.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY_MS = 86_400_000;

type StepResult = { ok: true; count: number } | { ok: false; error: string };

async function step(
  name: string,
  run: () => Promise<number | void>,
): Promise<StepResult> {
  try {
    const count = await run();
    return { ok: true, count: typeof count === "number" ? count : 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error({ step: name, err: message }, "maintenance step failed");
    return { ok: false, error: message };
  }
}

export async function POST(request: Request) {
  if (!isAuthorisedInternal(request)) return apiError("unauthorised");
  if (!isDatabaseConfigured())
    return apiError("unavailable", { detail: "DATABASE_URL is not set" });

  const now = new Date();
  // Device and IP hashes are kept 7 days, for rate limiting only. This is the
  // window the privacy notice states, so it must not drift from that copy.
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);

  const steps: Record<string, StepResult> = {
    expired: await step("expired", () => expireOverdueReports(now)),
    // Raw readings are kept for 14 days.
    readingsPruned: await step("readingsPruned", () =>
      pruneOldReadings(new Date(now.getTime() - 14 * DAY_MS)),
    ),
    identifiersCleared: await step("identifiersCleared", () =>
      clearOldIdentifiers(sevenDaysAgo),
    ),
    votesPruned: await step("votesPruned", () =>
      pruneVotesForExpiredReports(sevenDaysAgo),
    ),
    rateLimitsPruned: await step("rateLimitsPruned", () =>
      pruneRateLimits(new Date(now.getTime() - DAY_MS)),
    ),
  };

  const failed = Object.entries(steps)
    .filter(([, r]) => !r.ok)
    .map(([name]) => name);

  return NextResponse.json(
    { ok: failed.length === 0, at: now.toISOString(), failed, steps },
    {
      // 207 so the cron can tell "one step broke" from "nothing ran at all".
      status: failed.length === 0 ? 200 : 207,
      headers: { "cache-control": "no-store" },
    },
  );
}
