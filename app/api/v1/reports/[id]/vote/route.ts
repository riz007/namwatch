import { deviceHash, ipHash } from "@/lib/api/device.ts";
import { apiError, CACHE } from "@/lib/api/respond.ts";
import { reportIdSchema, voteSchema } from "@/lib/api/schemas.ts";
import { isDatabaseConfigured } from "@/lib/db/index.ts";
import { bumpRateLimit, castVote } from "@/lib/db/queries/reports.ts";
import { log } from "@/lib/log.ts";
import { combine, decide } from "@/lib/reports/rate-limit.ts";
import { NextResponse } from "next/server";

/**
 * `POST /api/v1/reports/:id/vote`. Never cached.
 * One vote per device per report; a vote extends or ends the
 * report's life. No Turnstile here — a vote is cheap and the per-device
 * uniqueness constraint already bounds the damage.
 */
/**
 * Voting is cheaper than reporting, so the ceiling is higher — but it is not
 * unlimited, because votes now decide how long a report lives.
 */
const VOTES_PER_WINDOW = 20;

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!reportIdSchema.safeParse(id).success) return apiError("not_found");
  if (!isDatabaseConfigured()) return apiError("unavailable");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_request", { detail: "expected a JSON body" });
  }

  const parsed = voteSchema.safeParse(body);
  if (!parsed.success)
    return apiError("invalid_request", {
      detail: "vote must be still, receded or flag",
    });

  let device: string;
  try {
    device = await deviceHash();
  } catch (error) {
    log.error({ err: String(error) }, "device hashing unavailable");
    return apiError("server_error");
  }

  // Two "receded" votes retire a report, so an unthrottled vote endpoint lets
  // anyone with a couple of fresh cookies suppress a real one. The per-device
  // primary key stops repeats; this stops volume.
  const now = new Date();
  const ip = ipHash(request);
  const counts = await Promise.all([
    bumpRateLimit(`vote:device:${device}`, now),
    ...(ip ? [bumpRateLimit(`vote:ip:${ip}`, now)] : []),
  ]);
  const limit = combine(
    counts.map((c) => decide(c - 1, now, VOTES_PER_WINDOW)),
  );
  if (!limit.allowed) return apiError("rate_limited");

  const outcome = await castVote(id, device, parsed.data.vote);
  if (outcome === "not_found") return apiError("not_found");

  return NextResponse.json(
    { outcome, vote: parsed.data.vote },
    {
      status: outcome === "already_voted" ? 200 : 201,
      headers: { "cache-control": CACHE.none },
    },
  );
}
