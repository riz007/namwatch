/**
 * Report freshness and expiry..
 *
 * Pure functions, no clock of their own: every entry point takes `now` so the
 * behaviour is deterministic and testable at the exact hour boundaries.
 */
import { DECAY } from "@/config/app.config.ts";

export type ReportKind = "road" | "home" | "canal" | "help";

const HOUR_MS = 3_600_000;

/** Hours after which a report is hidden unless reconfirmed. `help` lasts longer. */
export function hiddenAfterHours(kind: ReportKind): number {
  return kind === "help" ? DECAY.helpHiddenAtH : DECAY.hiddenAtH;
}

export const ageHours = (createdAt: Date, now: Date): number =>
  (now.getTime() - createdAt.getTime()) / HOUR_MS;

/**
 * Display opacity for a report pin. gives three anchors: full for the
 * first hour, 40% by six hours, hidden at twelve (twenty-four for `help`).
 *
 * Between six hours and the hide threshold the value is held at 40% rather than
 * fading further — the spec names 40% as the floor, and continuing to fade would
 * make a still-valid report nearly invisible before it actually expires.
 */
export function decayOpacity(
  createdAt: Date,
  kind: ReportKind,
  now: Date,
): number {
  const age = ageHours(createdAt, now);
  const hidden = hiddenAfterHours(kind);

  if (age < 0) return 1;
  if (age >= hidden) return 0;
  if (age <= DECAY.fullOpacityH) return 1;

  if (age < DECAY.fadedAtH) {
    const span = DECAY.fadedAtH - DECAY.fullOpacityH;
    const progress = (age - DECAY.fullOpacityH) / span;
    return 1 - progress * (1 - DECAY.fadedOpacity);
  }

  return DECAY.fadedOpacity;
}

/** The expiry a freshly submitted report is given. */
export const initialExpiry = (kind: ReportKind, now: Date): Date =>
  new Date(now.getTime() + hiddenAfterHours(kind) * HOUR_MS);

/**
 * A "still flooded" vote restarts the clock (a vote extends the
 * report's life), so a confirmed report keeps its full lifetime from the
 * confirmation rather than from when it was first filed.
 */
export const extendedExpiry = (kind: ReportKind, votedAt: Date): Date =>
  initialExpiry(kind, votedAt);

export const isExpired = (expiresAt: Date, now: Date): boolean =>
  now.getTime() >= expiresAt.getTime();
