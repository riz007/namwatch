"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

/**
 * Relative age of a datum. "Freshness is first-class" — every datum
 * shows its age, and non-negotiable 4 forbids styling these labels
 * into invisibility, so this renders at real body size, not as fine print.
 *
 * Uses Intl.RelativeTimeFormat. Re-renders on a slow interval so a
 * page left open during a flood does not quietly show a stale "2 min ago".
 */
const MINUTE = 60_000;

/**
 * The current minute, as an external store.
 *
 * `useSyncExternalStore` is the right primitive here rather than a
 * `useState` + `useEffect` pair: the server has no meaningful "now", and
 * quantising to the minute keeps the client snapshot stable between renders so
 * react does not loop. The server snapshot is null, so the first paint renders
 * the timestamp itself and hydration then sharpens it to a relative age.
 */
const subscribe = (onChange: () => void): (() => void) => {
  const id = setInterval(onChange, MINUTE);
  return () => clearInterval(id);
};

const useNowMinute = (): number | null =>
  useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / MINUTE),
    () => null,
  );

function relative(
  from: Date,
  now: Date,
  locale: string,
): { text: string; minutes: number } {
  const minutes = Math.round((now.getTime() - from.getTime()) / MINUTE);
  const rtf = new Intl.RelativeTimeFormat(locale, {
    numeric: "auto",
    style: "short",
  });

  if (minutes < 60) return { text: rtf.format(-minutes, "minute"), minutes };
  if (minutes < 60 * 24)
    return { text: rtf.format(-Math.round(minutes / 60), "hour"), minutes };
  return { text: rtf.format(-Math.round(minutes / (60 * 24)), "day"), minutes };
}

export function Freshness({
  at,
  /** Source cadence in minutes; past 3× this the datum is flagged as delayed. */
  cadenceMinutes,
  className,
}: {
  at: string | Date | null;
  cadenceMinutes?: number;
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("freshness");
  const nowMinute = useNowMinute();
  const now = nowMinute === null ? null : new Date(nowMinute * MINUTE);

  if (!at) return <span className={className}>{t("unknown")}</span>;

  const date = typeof at === "string" ? new Date(at) : at;
  if (Number.isNaN(date.getTime()))
    return <span className={className}>{t("unknown")}</span>;

  const reference = now ?? date;
  const { text, minutes } = relative(date, reference, locale);
  const delayed = cadenceMinutes !== undefined && minutes > cadenceMinutes * 3;

  return (
    <span className={className}>
      <time dateTime={date.toISOString()}>
        {minutes < 1 ? t("justNow") : text}
      </time>
      {delayed && (
        <>
          {" "}
          <span
            title={t("delayedHint")}
            className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-rule)] bg-[var(--color-paper-3)] px-1 text-[var(--text-xs)] font-medium text-[var(--color-ink-2)]"
          >
            <svg
              viewBox="0 0 12 12"
              className="size-3"
              aria-hidden="true"
              fill="currentColor"
            >
              <path d="M6 0a6 6 0 1 0 0 12A6 6 0 0 0 6 0Zm.6 3v3.3l2.2 1.3-.5.9L5.4 7V3h1.2Z" />
            </svg>
            {t("delayed")}
          </span>
        </>
      )}
    </span>
  );
}
