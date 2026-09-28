"use client";

import { DEPTH_BANDS } from "@/config/depth-bands.ts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { DepthPictogram } from "../DepthPictogram.tsx";

/**
 * The map key, as a map control.
 *
 * It sits on the map because that is the only place it is useful — a key below
 * the fold, under the thing it explains, is a key nobody reads. Closed by
 * default so it costs no space; opening it overlays the map rather than
 * reflowing the page, so the viewer does not lose their place.
 */
export function LegendControl() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t("legend.title")}
        className="press absolute top-3 left-3 z-10 inline-flex min-h-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-rule)] bg-[var(--color-paper)]/95 px-3 py-2.5 text-[var(--text-xs)] font-semibold text-[var(--color-ink-2)] shadow-[0_1px_6px_rgb(0_0_0/0.18)] backdrop-blur-sm hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      >
        <svg
          viewBox="0 0 16 16"
          className="size-3.5 fill-current"
          aria-hidden="true"
        >
          <path d="M8 1.4A6.6 6.6 0 1 0 8 14.6 6.6 6.6 0 0 0 8 1.4Zm.8 10.2H7.2V7h1.6v4.6Zm0-6.1H7.2V3.9h1.6v1.6Z" />
        </svg>
        {t("legend.short")}
      </button>

      {open && (
        <>
          {/* Tapping the map dismisses it, which is what people try first. */}
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={() => setOpen(false)}
            className="absolute inset-0 z-10 min-h-0 cursor-default bg-black/10"
          />
          <div
            role="dialog"
            aria-label={t("legend.title")}
            className="absolute top-3 left-3 z-20 max-h-[calc(100%-1.5rem)] w-[min(19rem,calc(100%-1.5rem))] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-rule)] bg-[var(--color-paper)] p-3 shadow-[0_6px_24px_rgb(0_0_0/0.22)]"
          >
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-[var(--text-sm)] font-bold text-[var(--color-ink)]">
                {t("legend.title")}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("common.close")}
                className="press grid size-8 min-h-0 place-items-center rounded-full text-[var(--color-muted)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]"
              >
                <svg
                  viewBox="0 0 16 16"
                  className="size-3.5 fill-current"
                  aria-hidden="true"
                >
                  <path d="M12.7 4.4 11.6 3.3 8 6.9 4.4 3.3 3.3 4.4 6.9 8l-3.6 3.6 1.1 1.1L8 9.1l3.6 3.6 1.1-1.1L9.1 8Z" />
                </svg>
              </button>
            </div>

            {/* Source first: it is the distinction a reader needs before any
                question of severity, and the one they asked us to make plain. */}
            <h3 className="pb-1 text-[var(--text-xs)] font-semibold tracking-wide text-[var(--color-muted)] uppercase">
              {t("source.label")}
            </h3>
            <ul className="space-y-1.5 pb-3">
              <Row
                mark={
                  <span
                    className="nw-legend nw-sensor"
                    style={{
                      background: "var(--color-depth-4)",
                      borderColor: "var(--color-paper)",
                    }}
                  />
                }
                label={`${t("provenance.officialSensor")} — ${t("source.sensorHint")}`}
              />
              <Row
                mark={
                  <span
                    className="nw-legend nw-crowd"
                    style={{
                      background: "var(--color-depth-4)",
                      borderColor: "var(--color-depth-4-border)",
                      color: "var(--color-depth-4-border)",
                    }}
                  />
                }
                label={`${t("provenance.crowd")} — ${t("source.peopleHint")}`}
              />
              <Row
                mark={<span className="nw-legend nw-channel" />}
                label={`${t("provenance.officialChannel")} — ${t("source.peopleHint")}`}
              />
            </ul>

            <h3 className="pb-1 text-[var(--text-xs)] font-semibold tracking-wide text-[var(--color-muted)] uppercase">
              {t("legend.title")}
            </h3>
            <ul className="space-y-1.5 pb-3">
              <Row
                mark={
                  <span
                    className="nw-legend nw-alarm"
                    style={{
                      background: "var(--color-depth-5)",
                      borderColor: "var(--color-paper)",
                    }}
                  />
                }
                label={t("legend.alarm")}
              />
              <Row
                mark={
                  <span
                    className="nw-legend nw-rain"
                    style={{ background: "var(--color-rain-heavy)" }}
                  />
                }
                label={t("rain.gauge")}
              />
              <Row
                mark={<span className="nw-cluster-legend">12</span>}
                label={t("legend.cluster")}
              />
            </ul>

            <h3 className="pb-1 text-[var(--text-xs)] font-semibold tracking-wide text-[var(--color-muted)] uppercase">
              {t("depth.label")}
            </h3>
            <ul className="grid gap-1">
              {DEPTH_BANDS.map((b) => (
                <li
                  key={b.band}
                  className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 text-[var(--text-xs)] font-medium"
                  style={{
                    backgroundColor: `var(--color-${b.token})`,
                    color: `var(--color-${b.token}-on)`,
                    boxShadow: `inset 0 0 0 1px var(--color-${b.token}-border)`,
                  }}
                >
                  <DepthPictogram band={b.band} className="size-4 shrink-0" />
                  <span>{t(`depth.${b.band}.label`)}</span>
                  <span className="ml-auto opacity-80">
                    {t(`depth.${b.band}.range`)}
                  </span>
                </li>
              ))}
            </ul>

            <p className="pt-2 text-[var(--text-xs)] text-[var(--color-muted)]">
              {t("legend.zoomHint")}
            </p>
          </div>
        </>
      )}
    </>
  );
}

function Row({ mark, label }: { mark: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2.5 text-[var(--text-sm)] text-[var(--color-ink-2)]">
      <span className="grid size-5 shrink-0 place-items-center">{mark}</span>
      {label}
    </li>
  );
}
