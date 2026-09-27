import { DECAY } from "@/config/app.config.ts";

export type ReportKind = "road" | "home" | "canal" | "help";

const HOUR_MS = 3_600_000;

/**
 * How long a report is treated as current, by how deep it is.
 *
 * Deeper water gets longer, because the two mistakes are not symmetric. Hiding
 * a puddle that has dried costs nothing; hiding chest-deep water that is still
 * there can get somebody killed. Severity therefore buys time.
 */
const CONFIDENT_HOURS: Record<number, number> = {
  0: 3,
  1: 6,
  2: 9,
  3: 12,
  4: 18,
  5: 24,
};

/**
 * After the confident window a report is not deleted — it is demoted to
 * `unconfirmed` and stays on the map, visibly aged, for this multiple of its
 * confident window.
 *
 * Silence is not evidence. Nobody voting means nobody was there to vote, and
 * in the worst-hit places that is exactly what happens: people evacuate, lose
 * power, lose signal. Treating silence as "the water has gone" deletes reports
 * from the areas that most need to be visible.
 */
const UNCONFIRMED_MULTIPLE = 3;

/** A help report outlives everything; losing one is the worst failure here. */
const HELP_CONFIDENT_HOURS = 24;

export type Confidence = "confident" | "unconfirmed" | "gone";

function confidentHours(
  kind: ReportKind,
  depthBand: number,
  corroborated: boolean,
): number {
  const base =
    kind === "help"
      ? HELP_CONFIDENT_HOURS
      : (CONFIDENT_HOURS[depthBand] ?? DECAY.hiddenAtH);
  // An official gauge within 500 m that is itself showing flooding is better
  // evidence than a neighbour tapping a button, so it counts for more.
  return corroborated ? base * 2 : base;
}

/** When the report should stop being shown at all. */
export function hideAfterHours(
  kind: ReportKind,
  depthBand: number,
  corroborated = false,
): number {
  return (
    confidentHours(kind, depthBand, corroborated) * (1 + UNCONFIRMED_MULTIPLE)
  );
}

export const ageHours = (createdAt: Date, now: Date): number =>
  (now.getTime() - createdAt.getTime()) / HOUR_MS;

export function confidenceOf(
  createdAt: Date,
  kind: ReportKind,
  depthBand: number,
  now: Date,
  corroborated = false,
): Confidence {
  const age = ageHours(createdAt, now);
  if (age < 0) return "confident";
  if (age <= confidentHours(kind, depthBand, corroborated)) return "confident";
  if (age < hideAfterHours(kind, depthBand, corroborated)) return "unconfirmed";
  return "gone";
}

/**
 * Display opacity. Full while confident, then visibly faded once unconfirmed
 * so the distinction is legible at a glance as well as in the label.
 */
export function decayOpacity(
  createdAt: Date,
  kind: ReportKind,
  now: Date,
  depthBand = 3,
  corroborated = false,
): number {
  const age = ageHours(createdAt, now);
  if (age < 0) return 1;

  const confident = confidentHours(kind, depthBand, corroborated);
  const hide = hideAfterHours(kind, depthBand, corroborated);
  if (age >= hide) return 0;

  if (age <= DECAY.fullOpacityH) return 1;
  if (age <= confident) {
    const span = Math.max(confident - DECAY.fullOpacityH, 0.001);
    const progress = (age - DECAY.fullOpacityH) / span;
    return 1 - progress * (1 - DECAY.fadedOpacity);
  }
  // Unconfirmed: held at a clearly reduced weight rather than fading to
  // invisibility, so it can still be seen and judged.
  return DECAY.fadedOpacity * 0.75;
}

/** Expiry stored at insert: the point where it stops being shown entirely. */
export const initialExpiry = (
  kind: ReportKind,
  now: Date,
  depthBand = 3,
): Date => new Date(now.getTime() + hideAfterHours(kind, depthBand) * HOUR_MS);

/** A "still flooded" vote restarts the clock from the confirmation. */
export const extendedExpiry = (
  kind: ReportKind,
  votedAt: Date,
  depthBand = 3,
): Date => initialExpiry(kind, votedAt, depthBand);

export const isExpired = (expiresAt: Date, now: Date): boolean =>
  now.getTime() >= expiresAt.getTime();

/** Kept for the maintenance job and older callers. */
export function hiddenAfterHours(kind: ReportKind): number {
  return hideAfterHours(kind, 3);
}
