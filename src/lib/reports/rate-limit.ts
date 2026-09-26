/**
 * Submission rate limiting. 5 reports per 10 minutes, per device hash
 * AND per IP hash. Pure window maths here; the counter store lives in the DB
 * (`rate_limits`) so it survives a cold function.
 */
import { RATE_LIMIT } from "@/config/app.config.ts";

export type RateLimitDecision = {
  readonly allowed: boolean;
  readonly remaining: number;
  /** When the caller may try again. Null when they are not limited. */
  readonly retryAfter: Date | null;
};

/** Fixed windows, so a key is simply (identity, window start). */
export function windowStart(
  now: Date,
  windowMs: number = RATE_LIMIT.windowMs,
): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export function decide(
  currentCount: number,
  now: Date,
  max: number = RATE_LIMIT.maxReports,
  windowMs: number = RATE_LIMIT.windowMs,
): RateLimitDecision {
  const allowed = currentCount < max;
  return {
    allowed,
    remaining: Math.max(0, max - currentCount),
    retryAfter: allowed
      ? null
      : new Date(windowStart(now, windowMs).getTime() + windowMs),
  };
}

/**
 * The strictest of several identities wins — a device behind a shared IP and an
 * IP running many devices are both limited.
 */
export function combine(
  decisions: readonly RateLimitDecision[],
): RateLimitDecision {
  const blocked = decisions.filter((d) => !d.allowed);
  if (blocked.length === 0) {
    return {
      allowed: true,
      remaining: Math.min(...decisions.map((d) => d.remaining)),
      retryAfter: null,
    };
  }
  const retryAfter =
    blocked
      .map((d) => d.retryAfter)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  return { allowed: false, remaining: 0, retryAfter };
}
