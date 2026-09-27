"use client";

import { isDepthBand } from "@/config/depth-bands.ts";
import { hotlinesFor } from "@/config/hotlines.ts";
import { rainBandFor } from "@/config/rain-bands.ts";
import { BANGKOK_REGION_ID } from "@/config/regions.ts";
import { track } from "@/lib/analytics.ts";
import {
  isExternal,
  isReport,
  isStation,
  type AnyProps,
} from "@/lib/api/map-types.ts";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { DepthChip } from "../DepthChip.tsx";
import { Freshness } from "../Freshness.tsx";
import { ProvenanceBadge } from "../Provenance.tsx";
import { RainChip } from "../RainChip.tsx";

/**
 * What is actually at this point on the map.
 *
 * A symbol on its own is useless to anyone who has to go there. This is what
 * turns a marker into something a rescue worker, a district officer or a
 * neighbour can act on: coordinates they can copy, a link that opens their
 * navigation app, and an honest statement of how precise the position is.
 */
export function DetailSheet({
  selected,
  onClose,
  onVote,
}: {
  selected: { props: AnyProps; lon: number; lat: number } | null;
  onClose: () => void;
  onVote?: (id: string, vote: "still" | "receded") => void;
}) {
  const t = useTranslations();
  const locale = useLocale();

  // Escape closes it, which is what a keyboard user will try.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, onClose]);

  if (!selected) return null;
  const { props: p, lon, lat } = selected;

  // Home and help reports are published at the centre of their H3 cell, so the
  // point is an area, not an address. Saying so matters: five decimal places
  // look like metre precision and these are not.
  const approximate = isReport(p) && (p.kind === "home" || p.kind === "help");

  return (
    <>
      <button
        type="button"
        aria-label={t("common.close")}
        onClick={onClose}
        className="fixed inset-0 z-40 min-h-0 cursor-default bg-black/35"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t("detail.title")}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-2xl border-t border-[var(--color-rule)] bg-[var(--color-paper)] shadow-[0_-8px_32px_rgb(0_0_0/0.28)]"
      >
        <div className="sticky top-0 flex items-start gap-3 border-b border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-[var(--color-ink)]">
              {title(p, locale, t)}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
              <ProvenanceBadge
                level={p.provenance}
                source={isStation(p) || isExternal(p) ? p.source : null}
              />
              <span aria-hidden="true" className="text-[var(--color-rule)]">
                ·
              </span>
              <Freshness
                at={
                  isStation(p)
                    ? p.observedAt
                    : isExternal(p)
                      ? p.observedAt
                      : p.createdAt
                }
                className="text-[var(--text-xs)] text-[var(--color-muted)]"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="press grid size-9 shrink-0 place-items-center rounded-full text-[var(--color-muted)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]"
          >
            <svg
              viewBox="0 0 16 16"
              className="size-4 fill-current"
              aria-hidden="true"
            >
              <path d="M12.7 4.4 11.6 3.3 8 6.9 4.4 3.3 3.3 4.4 6.9 8l-3.6 3.6 1.1 1.1L8 9.1l3.6 3.6 1.1-1.1L9.1 8Z" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <Reading p={p} />
          <Location lon={lon} lat={lat} approximate={approximate} />

          {isReport(p) && onVote && (
            <div>
              <p className="pb-2 text-[var(--text-sm)] text-[var(--color-ink-2)]">
                {t("detail.confirmPrompt")}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onVote(p.id, "still")}
                  className="btn btn-secondary press flex-1"
                >
                  {t("vote.still")}
                </button>
                <button
                  type="button"
                  onClick={() => onVote(p.id, "receded")}
                  className="btn btn-secondary press flex-1"
                >
                  {t("vote.receded")}
                </button>
              </div>
              {(p.stillCount > 0 || p.recededCount > 0) && (
                <p className="tabular pt-2 text-[var(--text-xs)] text-[var(--color-muted)]">
                  {t("vote.confirmations", { count: p.stillCount })}
                </p>
              )}
            </div>
          )}

          {isReport(p) && p.kind === "help" && (
            <aside className="rounded-[var(--radius-md)] border border-[var(--color-rule)] p-3">
              <h3 className="text-[var(--text-xs)] font-semibold tracking-wide text-[var(--color-muted)] uppercase">
                {t("detail.forResponders")}
              </h3>
              {/* Hard rule 3: never imply we dispatch anyone. */}
              <p className="pt-1 text-[var(--text-sm)] leading-relaxed text-[var(--color-ink-2)]">
                {t("detail.respondersNote")}
              </p>
              <ul className="flex flex-wrap gap-2 pt-2">
                {hotlinesFor(BANGKOK_REGION_ID).map((h) => (
                  <li key={h.number}>
                    <a
                      href={`tel:${h.number}`}
                      onClick={() =>
                        track("hotline_tap", { hotline: h.number })
                      }
                      className="tabular press inline-flex items-center rounded-[var(--radius-sm)] border border-[var(--color-rule)] px-2 py-1 text-[var(--text-sm)] font-semibold text-[var(--color-ink)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                    >
                      {h.number}
                    </a>
                  </li>
                ))}
              </ul>
            </aside>
          )}

          {isExternal(p) && p.url && (
            <a
              href={p.url}
              target="_blank"
              rel="noreferrer noopener"
              className="btn btn-secondary press w-full"
            >
              {t("detail.openTicket")}
            </a>
          )}
        </div>
      </section>
    </>
  );
}

function title(
  p: AnyProps,
  locale: string,
  t: ReturnType<typeof useTranslations>,
): string {
  if (isStation(p)) {
    return (
      (locale === "th" ? p.nameTh : p.nameEn) ?? p.nameTh ?? p.nameEn ?? p.id
    );
  }
  if (isReport(p)) return t(`kind.${p.kind}`);
  return p.description ?? t("provenance.officialChannel");
}

function Reading({ p }: { p: AnyProps }) {
  const t = useTranslations();

  if (isStation(p)) {
    if (p.kind === "rain") {
      const band = rainBandFor(p.value);
      return band ? <RainChip band={band} mm={p.value} /> : null;
    }
    return (
      <dl className="tabular grid grid-cols-2 gap-2 text-[var(--text-sm)]">
        <Cell
          label={t("station.waterLevel")}
          value={p.value === null ? "—" : `${p.value.toFixed(2)} m`}
        />
        <Cell
          label={t("station.bankLevel")}
          value={p.bankLevelM === null ? "—" : `${p.bankLevelM.toFixed(2)} m`}
        />
        {p.value !== null && p.bankLevelM !== null && (
          <div className="col-span-2">
            <span className="font-semibold text-[var(--color-ink)]">
              {p.value >= p.bankLevelM
                ? t("station.aboveBank", {
                    meters: (p.value - p.bankLevelM).toFixed(2),
                  })
                : t("station.belowBank", {
                    meters: (p.bankLevelM - p.value).toFixed(2),
                  })}
            </span>
          </div>
        )}
      </dl>
    );
  }

  if (isReport(p)) {
    return (
      <div className="space-y-2">
        {isDepthBand(p.depthBand) && <DepthChip band={p.depthBand} showRange />}
        {p.note && <p className="text-[var(--color-ink-2)]">{p.note}</p>}
        {p.confidence === "unconfirmed" && (
          <p className="text-[var(--text-sm)] text-[var(--color-muted)]">
            {t("report.unconfirmed")}
          </p>
        )}
      </div>
    );
  }

  return p.state ? (
    <span className="inline-flex rounded-[var(--radius-sm)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-2 py-1 text-[var(--text-sm)] text-[var(--color-ink-2)]">
      {p.state}
    </span>
  ) : null;
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[var(--text-xs)] text-[var(--color-muted)]">
        {label}
      </dt>
      <dd className="font-semibold text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

/**
 * The coordinates, in the forms people actually need: copyable decimal degrees
 * for a report or a radio call, and a link that opens a navigation app.
 */
function Location({
  lon,
  lat,
  approximate,
}: {
  lon: number;
  lat: number;
  approximate: boolean;
}) {
  const t = useTranslations("detail");
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const value = useRef<HTMLParagraphElement | null>(null);
  const pair = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

  /**
   * Three attempts, because the first one fails more often than it looks.
   *
   * A large share of Thai traffic arrives inside the LINE and Facebook in-app
   * browsers, where the async Clipboard API is frequently denied — and a Copy
   * button that silently does nothing is worse than no button at all when the
   * thing being copied is where to send a boat. So: the modern API, then the
   * legacy command that still works in those WebViews, and failing both, select
   * the text and say to copy it by hand.
   */
  const copy = async (): Promise<void> => {
    const done = (): void => {
      track("coords_copied");
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    };

    try {
      await navigator.clipboard.writeText(pair);
      done();
      return;
    } catch {
      // Fall through.
    }

    const node = value.current;
    if (node) {
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      try {
        if (document.execCommand("copy")) {
          done();
          return;
        }
      } catch {
        // Fall through.
      }
      // The text is left selected, so one long-press finishes the job.
    }
    setState("manual");
  };

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[var(--text-xs)] font-semibold tracking-wide text-[var(--color-muted)] uppercase">
          {t("coordinates")}
        </span>
        <button
          type="button"
          onClick={copy}
          className="press text-[var(--text-sm)] font-semibold text-[var(--color-accent)]"
        >
          {state === "copied" ? t("copied") : t("copy")}
        </button>
      </div>

      {/* Selectable, so it can be copied by hand where the clipboard is blocked. */}
      <p
        ref={value}
        className="tabular pt-1 text-[var(--text-lg)] font-semibold break-all text-[var(--color-ink)] select-all"
      >
        {pair}
      </p>

      {/* Announced, because the person is mid-task and looking at the button. */}
      <p role="status" className="sr-only">
        {state === "copied" ? t("copied") : ""}
      </p>
      {state === "manual" && (
        <p className="pt-1 text-[var(--text-xs)] font-medium text-[var(--color-ink-2)]">
          {t("copyManual")}
        </p>
      )}

      {/* Five decimal places look like metre precision. Say which it is, every
          time — a responder who assumes the wrong one searches the wrong place. */}
      <p className="pt-1.5 text-[var(--text-xs)] leading-relaxed text-[var(--color-muted)]">
        {approximate ? t("approximate") : t("exact")}
      </p>

      <a
        href={`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`}
        target="_blank"
        rel="noreferrer noopener"
        className="btn btn-secondary press mt-3 w-full"
      >
        {t("openInMaps")}
      </a>
    </div>
  );
}
