import "server-only";

import { publicLocation } from "@/lib/geo/h3.ts";
import { resolveRegionId } from "@/lib/geo/region.ts";
import {
  extendedExpiry,
  initialExpiry,
  type ReportKind,
} from "@/lib/reports/decay.ts";
import { windowStart } from "@/lib/reports/rate-limit.ts";
import { shouldAutoHide, shouldExpireFromVotes } from "@/lib/reports/trust.ts";
import type { LonLat } from "@/lib/sources/types.ts";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../index.ts";
import { rateLimits, reportVotes, reports } from "../schema.ts";

/**
 * Report writes and public reads. SQL lives only here.
 *
 * No select in this file names `geom_exact`. The exact point is
 * written once at insert and thereafter only used by server-side distance maths.
 */

const asGeography = (p: LonLat) =>
  sql`ST_MakePoint(${p.lon}, ${p.lat})::geography`;

export type NewReport = {
  readonly kind: ReportKind;
  readonly depthBand: number;
  readonly passableBy: readonly string[] | null;
  readonly note: string | null;
  readonly locale: "th" | "en";
  readonly point: LonLat;
  readonly districtTh: string | null;
  readonly deviceHash: string;
  readonly ipHash: string | null;
};

export async function insertReport(
  input: NewReport,
  now: Date = new Date(),
): Promise<string> {
  const { exact, publicPoint, h3R9 } = publicLocation(input.point, input.kind);

  const [row] = await db()
    .insert(reports)
    .values({
      kind: input.kind,
      depthBand: input.depthBand,
      passableBy: input.passableBy ? [...input.passableBy] : null,
      note: input.note,
      locale: input.locale,
      geomExact: sql`${asGeography(exact)}` as never,
      geomPublic: sql`${asGeography(publicPoint)}` as never,
      h3R9,
      regionId: resolveRegionId(input.districtTh),
      deviceHash: input.deviceHash,
      ipHash: input.ipHash,
      createdAt: now,
      expiresAt: initialExpiry(input.kind, now, input.depthBand),
    })
    .returning({ id: reports.id });

  if (!row) throw new Error("insert returned no row");
  return row.id;
}

export type PublicReport = {
  id: string;
  kind: string;
  depthBand: number;
  passableBy: string[] | null;
  note: string | null;
  lon: number;
  lat: number;
  createdAt: Date;
  expiresAt: Date;
  stillCount: number;
  recededCount: number;
  status: string;
  regionId: string | null;
};

/** `GET /api/v1/reports/:id` — public fields only. */
export async function findPublicReport(
  id: string,
): Promise<PublicReport | null> {
  const [row] = await db()
    .select({
      id: reports.id,
      kind: reports.kind,
      depthBand: reports.depthBand,
      passableBy: reports.passableBy,
      note: reports.note,
      lon: sql<number>`ST_X(${reports.geomPublic}::geometry)`,
      lat: sql<number>`ST_Y(${reports.geomPublic}::geometry)`,
      createdAt: reports.createdAt,
      expiresAt: reports.expiresAt,
      stillCount: reports.stillCount,
      recededCount: reports.recededCount,
      status: reports.status,
      regionId: reports.regionId,
    })
    .from(reports)
    .where(and(eq(reports.id, id), eq(reports.status, "active")))
    .limit(1);

  return row ?? null;
}

export type VoteKind = "still" | "receded" | "flag";

export type VoteOutcome = "recorded" | "already_voted" | "not_found";

/**
 * Records one vote and applies its consequence..
 *
 * Runs in a transaction so the counter, the expiry change and the auto-hide can
 * never disagree. One vote per device per report is enforced by the composite
 * primary key, so a duplicate is a no-op rather than an error.
 */
export async function castVote(
  reportId: string,
  deviceHash: string,
  vote: VoteKind,
  now: Date = new Date(),
): Promise<VoteOutcome> {
  return db().transaction(async (tx) => {
    const [target] = await tx
      .select({
        kind: reports.kind,
        status: reports.status,
        depthBand: reports.depthBand,
      })
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    if (!target || target.status !== "active") return "not_found";

    const inserted = await tx
      .insert(reportVotes)
      .values({ reportId, deviceHash, vote, createdAt: now })
      .onConflictDoNothing()
      .returning({ reportId: reportVotes.reportId });

    if (inserted.length === 0) return "already_voted";

    const column =
      vote === "still"
        ? reports.stillCount
        : vote === "receded"
          ? reports.recededCount
          : reports.flagCount;

    const [updated] = await tx
      .update(reports)
      .set({ [columnName(vote)]: sql`${column} + 1` })
      .where(eq(reports.id, reportId))
      .returning({
        still: reports.stillCount,
        receded: reports.recededCount,
        flags: reports.flagCount,
      });

    if (!updated) return "not_found";

    const counts = {
      still: updated.still,
      receded: updated.receded,
      flags: updated.flags,
    };

    if (shouldAutoHide(counts)) {
      await tx
        .update(reports)
        .set({ status: "hidden" })
        .where(eq(reports.id, reportId));
    } else if (shouldExpireFromVotes(counts)) {
      await tx
        .update(reports)
        .set({ status: "expired", expiresAt: now })
        .where(eq(reports.id, reportId));
    } else if (vote === "still") {
      await tx
        .update(reports)
        .set({
          expiresAt: extendedExpiry(
            target.kind as ReportKind,
            now,
            target.depthBand,
          ),
        })
        .where(eq(reports.id, reportId));
    }

    return "recorded";
  });
}

const columnName = (
  vote: VoteKind,
): "stillCount" | "recededCount" | "flagCount" =>
  vote === "still"
    ? "stillCount"
    : vote === "receded"
      ? "recededCount"
      : "flagCount";

/**
 * Increments and reads a rate-limit counter atomically..
 * Returns the count *including* this attempt.
 */
export async function bumpRateLimit(
  key: string,
  now: Date = new Date(),
): Promise<number> {
  const start = windowStart(now);
  const [row] = await db()
    .insert(rateLimits)
    .values({ key, windowStart: start, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });

  return row?.count ?? 1;
}

/** retention: expire what is past its time. Called by /api/internal/maintain. */
export async function expireOverdueReports(
  now: Date = new Date(),
): Promise<number> {
  const rows = await db()
    .update(reports)
    .set({ status: "expired" })
    .where(
      and(eq(reports.status, "active"), sql`${reports.expiresAt} <= ${now}`),
    )
    .returning({ id: reports.id });
  return rows.length;
}

/** Rate-limit rows are only useful inside their window; drop the rest. */
export async function pruneRateLimits(olderThan: Date): Promise<void> {
  await db()
    .delete(rateLimits)
    .where(sql`${rateLimits.windowStart} < ${olderThan}`);
}

/**
 * Clear the identifiers on the seventh day, which is what the privacy notice
 * promises.
 *
 * Both hashes, not just the IP one: the notice says "device and IP", and for a
 * while only the IP half was true. Neither is needed after the rate-limit
 * window, which is measured in minutes.
 */
export async function clearOldIdentifiers(olderThan: Date): Promise<number> {
  const rows = await db()
    .update(reports)
    .set({ ipHash: null, deviceHash: null })
    .where(
      and(
        sql`(${reports.ipHash} is not null or ${reports.deviceHash} is not null)`,
        sql`${reports.createdAt} < ${olderThan}`,
      ),
    )
    .returning({ id: reports.id });
  return rows.length;
}

/**
 * Votes carry a device hash of their own, and they outlive the report they
 * belong to because a report is only ever marked expired, never deleted. Once
 * a report has been off the map for a week its votes can decide nothing, so
 * the hashes go with them.
 */
export async function pruneVotesForExpiredReports(
  olderThan: Date,
): Promise<number> {
  const rows = await db()
    .delete(reportVotes)
    .where(
      sql`${reportVotes.reportId} in (
        select ${reports.id} from ${reports}
        where ${reports.expiresAt} < ${olderThan}
      )`,
    )
    .returning({ reportId: reportVotes.reportId });
  return rows.length;
}

export async function countRecentByDevice(
  deviceHash: string,
  since: Date,
): Promise<number> {
  const [row] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(reports)
    .where(
      and(eq(reports.deviceHash, deviceHash), gte(reports.createdAt, since)),
    );
  return row?.n ?? 0;
}
