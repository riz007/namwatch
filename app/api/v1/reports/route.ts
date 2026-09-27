import { deviceHash, ipHash } from "@/lib/api/device.ts";
import { apiError, CACHE } from "@/lib/api/respond.ts";
import { newReportSchema, parseReportBody } from "@/lib/api/schemas.ts";
import { verifyTurnstile } from "@/lib/api/turnstile.ts";
import { isDatabaseConfigured } from "@/lib/db/index.ts";
import { bumpRateLimit, insertReport } from "@/lib/db/queries/reports.ts";
import { log } from "@/lib/log.ts";
import { validateNote } from "@/lib/reports/note.ts";
import { combine, decide } from "@/lib/reports/rate-limit.ts";
import { NextResponse } from "next/server";

/**
 * `POST /api/v1/reports`. Never cached.
 *
 * Order matters: Turnstile first (cheapest way to shed bot load), then the rate
 * limit, then validation, then the write. A rejected submission must never cost
 * a database write.
 *
 * Photos are — a file part in the multipart body is accepted and ignored.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isDatabaseConfigured())
    return apiError("unavailable", { detail: "DATABASE_URL is not set" });

  let raw: unknown;
  try {
    raw = await parseReportBody(request);
  } catch {
    return apiError("invalid_request", {
      detail: "could not read the request body",
    });
  }

  const parsed = newReportSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError("invalid_request", {
      detail: parsed.error.issues[0]?.message,
    });
  }
  const input = parsed.data;

  // No URLs in notes, plus a profanity tripwire.
  const noteCheck = validateNote(input.note ?? null);
  if (!noteCheck.ok) {
    return apiError("invalid_request", { detail: noteCheck.reason });
  }

  const ip = ipHash(request);
  const verification = await verifyTurnstile(input.turnstileToken, null);
  if (!verification.ok) {
    log.warn(
      { reason: verification.reason },
      "turnstile rejected a submission",
    );
    return apiError("turnstile_failed", { detail: verification.reason });
  }

  let device: string;
  try {
    device = await deviceHash();
  } catch (error) {
    log.error({ err: String(error) }, "device hashing unavailable");
    return apiError("server_error");
  }

  // 5 per 10 min, per device hash AND per IP hash.
  const now = new Date();
  const counts = await Promise.all([
    bumpRateLimit(`device:${device}`, now),
    ...(ip ? [bumpRateLimit(`ip:${ip}`, now)] : []),
  ]);
  const limit = combine(counts.map((c) => decide(c - 1, now)));
  if (!limit.allowed) {
    return apiError("rate_limited", {
      headers: limit.retryAfter
        ? {
            "retry-after": String(
              Math.ceil((limit.retryAfter.getTime() - now.getTime()) / 1000),
            ),
          }
        : undefined,
    });
  }

  try {
    const id = await insertReport(
      {
        kind: input.kind,
        depthBand: input.depthBand,
        passableBy: input.passableBy ?? null,
        note: input.note ?? null,
        locale: input.locale,
        point: { lon: input.lon, lat: input.lat },
        districtTh: input.districtTh ?? null,
        deviceHash: device,
        ipHash: ip,
      },
      now,
    );

    log.info(
      { kind: input.kind, depthBand: input.depthBand },
      "report accepted",
    );

    return NextResponse.json(
      { id, createdAt: now.toISOString() },
      { status: 201, headers: { "cache-control": CACHE.none } },
    );
  } catch (error) {
    log.error({ err: String(error) }, "report insert failed");
    return apiError("server_error");
  }
}
