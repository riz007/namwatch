"use client";

import { BANGKOK_BBOX, type TimeWindowH } from "@/config/app.config.ts";
import type { DepthBandValue } from "@/config/depth-bands.ts";
import { Link } from "@/i18n/navigation.ts";
import { track } from "@/lib/analytics.ts";
import type { AnyProps, MapFeature } from "@/lib/api/map-types.ts";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { Freshness } from "../Freshness.tsx";
import {
  DepthFilter,
  SourceFilterControl,
  TimeFilter,
  ViewToggle,
  type SourceFilter,
  type View,
} from "./Controls.tsx";
import { DetailSheet } from "./DetailSheet.tsx";
import { FloodList } from "./FloodList.tsx";
import { LegendControl } from "./LegendControl.tsx";
import { severityBandOf } from "./markers.ts";
import { RoadList } from "./RoadList.tsx";
import { SourceStrip } from "./SourceStrip.tsx";
import { SummaryBar } from "./SummaryBar.tsx";
import { useFloodData } from "./useFloodData.ts";
import { useGeolocation } from "./useGeolocation.ts";

/**
 * Screen 1 — Map + List.
 *
 * Macrostructure: Map / Diagram. The map is the composition; everything else is
 * orientation around it.
 *
 * The map chunk is lazy so the initial bundle stays under the
 * budget, and so the List view costs nothing on a phone that will never render
 * webGL.
 */
const MapCanvas = dynamic(
  () => import("./MapCanvas.tsx").then((m) => m.MapCanvas),
  {
    ssr: false,
    loading: () => <MapSkeleton />,
  },
);

export function FloodScreen() {
  const t = useTranslations();
  const [view, setView] = useState<View>("map");
  const [minDepth, setMinDepth] = useState<DepthBandValue>(0);
  const [hours, setHours] = useState<TimeWindowH>(12);
  const [source, setSource] = useState<SourceFilter>("all");

  const [selected, setSelected] = useState<{
    props: AnyProps;
    lon: number;
    lat: number;
  } | null>(null);

  const { data, error, isLoading, mutate } = useFloodData(BANGKOK_BBOX, hours);
  const geo = useGeolocation();

  const select = useCallback(
    (next: { props: AnyProps; lon: number; lat: number }) => {
      track("detail_open", { layer: next.props.layer });
      setSelected(next);
    },
    [],
  );

  // The device id lives in an httpOnly cookie the server mints, so a
  // same-origin POST is all the identity this needs.
  const vote = useCallback(
    async (id: string, choice: "still" | "receded") => {
      await fetch(`/api/v1/reports/${id}/vote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vote: choice }),
      });
      track("vote_cast", { vote: choice });
      setSelected(null);
      void mutate();
    },
    [mutate],
  );

  const features = useMemo<MapFeature[]>(() => {
    if (!data) return [];
    return data.features.filter((f) => {
      // "People" means anything a person typed: our own reports and the cases
      // filed with the city. "Sensors" means an instrument measured it.
      if (source !== "all") {
        const measured = f.properties.provenance === "official_sensor";
        if (source === "sensor" ? !measured : measured) return false;
      }
      if (minDepth === 0) return true;
      const band = severityBandOf(f.properties);
      return band !== null && band >= minDepth;
    });
  }, [data, minDepth, source]);

  const hiddenCount = (data?.features.length ?? 0) - features.length;

  return (
    <div className="flex min-h-[calc(100dvh-96px)] flex-col">
      {/* Orientation row — the Map/Diagram macrostructure's small heading beside
          the composition, not a hero above it. */}
      <div className="flex flex-wrap items-center gap-2.5 px-4 pt-3 pb-2">
        <h1 className="sr-only">{t("map.title")}</h1>
        <div className="min-w-[180px] flex-1">
          <ViewToggle
            view={view}
            onChange={(v) => {
              track("view_toggle", { view: v });
              setView(v);
            }}
          />
        </div>
        <TimeFilter hours={hours} onChange={setHours} />
      </div>

      {/* An empty map during a flood reads as "nothing is happening". If the
          feed has stalled, say so before anyone draws that conclusion. */}
      {data && data.meta.staleSources.length > 0 && (
        <div
          role="alert"
          className="mx-4 mb-2 rounded-[var(--radius-md)] border-2 border-[var(--color-alert)] bg-[var(--color-alert)] px-3 py-2.5 text-[var(--color-alert-ink)]"
        >
          <p className="flex items-start gap-2 text-[var(--text-sm)] font-bold">
            <svg
              viewBox="0 0 24 24"
              className="mt-0.5 size-4 shrink-0 fill-current"
              aria-hidden="true"
            >
              <path d="M12 2.2 1.4 20.6h21.2L12 2.2Zm-.9 6.4h1.8v6h-1.8v-6Zm0 7.4h1.8v1.8h-1.8v-1.8Z" />
            </svg>
            {t("freshness.stalledTitle")}
          </p>
          <p className="pt-1 pl-6 text-[var(--text-xs)] leading-relaxed opacity-90">
            {t("freshness.stalledBody")}{" "}
            {data.meta.newestAt && (
              <Freshness at={data.meta.newestAt} className="font-semibold" />
            )}
          </p>
        </div>
      )}

      {data && (
        <SummaryBar
          features={data.features}
          stale={data.meta.staleSources.length > 0}
          degraded={data.meta.degraded.length > 0}
        />
      )}

      <div className="space-y-1.5 px-4 pb-2">
        {/* `overflow-x: auto` clips the other axis too, which cut the top off the
            selected swatch's ring and lift. The padding gives them room; the
            negative margin keeps the row's outer spacing unchanged. */}
        <div className="-mx-1 -my-1.5 flex items-center gap-2 overflow-x-auto px-1 py-1.5">
          <SourceFilterControl
            value={source}
            onChange={(v) => {
              track("layer_toggle", { view: v });
              setSource(v);
            }}
          />
        </div>
        <div className="-mx-1 -my-1.5 flex items-center gap-2 overflow-x-auto px-1 py-1.5">
          <DepthFilter min={minDepth} onChange={setMinDepth} />
        </div>
        <p className="text-[var(--text-xs)] text-[var(--color-muted)]">
          {minDepth === 0
            ? features.length === 0 && data
              ? t("filter.noneInWindow", { hours })
              : t("filter.showingAll", { count: features.length })
            : t("filter.showingAtLeast", {
                label: t(`depth.${minDepth}.label`),
                count: features.length,
                hidden: hiddenCount,
              })}
          {minDepth > 0 && (
            <button
              type="button"
              onClick={() => setMinDepth(0)}
              className="ml-1.5 min-h-0 font-semibold text-[var(--color-accent)] underline underline-offset-2 hover:no-underline"
            >
              {t("filter.clear")}
            </button>
          )}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mx-4 mb-2 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-3 py-2 text-[var(--text-sm)]"
        >
          <span className="text-[var(--color-ink)]">{t("map.error")}</span>
          <span className="text-[var(--color-muted)]">
            {t("error.network")}
          </span>
        </div>
      )}

      {/* Hard rule 5: name the layer that is missing rather than quietly showing less. */}
      {data?.meta.degraded && data.meta.degraded.length > 0 && (
        <div
          role="status"
          className="mx-4 mb-2 rounded-[var(--radius-md)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-ink-2)]"
        >
          {t("freshness.delayed")} · {data.meta.degraded.join(", ")}
        </div>
      )}

      <div className="relative min-h-[420px] flex-1 border-y border-[var(--color-rule)]">
        {view === "map" ? (
          isLoading && !data ? (
            <MapSkeleton />
          ) : (
            <MapCanvas
              features={features}
              focus={geo.state.status === "ready" ? geo.state : null}
              onSelect={select}
            />
          )
        ) : (
          // Pb-20 keeps the last rows clear of the floating report button.
          <div className="absolute inset-0 overflow-y-auto pb-20">
            {isLoading && !data ? (
              <ListSkeleton />
            ) : view === "roads" ? (
              <RoadList features={features} onSelect={select} />
            ) : (
              <FloodList features={features} onSelect={select} />
            )}
          </div>
        )}

        {view === "map" && <LegendControl />}

        {/* Locate sits above the primary action, out of the thumb arc. */}
        {view === "map" && (
          <button
            type="button"
            onClick={() => {
              track("locate_me");
              geo.locate();
            }}
            aria-label={t("map.locate")}
            className="press absolute right-3 bottom-20 grid size-12 min-h-0 place-items-center rounded-full border border-[var(--color-rule)] bg-[var(--color-paper)] text-[var(--color-ink)] shadow-[0_2px_8px_rgb(0_0_0/0.16)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-60"
            disabled={geo.state.status === "locating"}
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3.2" fill="currentColor" />
              <circle
                cx="12"
                cy="12"
                r="7.2"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <path
                d="M12 1.4v3.2M12 19.4v3.2M22.6 12h-3.2M4.6 12H1.4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}

        {(geo.state.status === "denied" ||
          geo.state.status === "unavailable") && (
          <p
            role="status"
            className="absolute inset-x-3 bottom-36 rounded-[var(--radius-md)] border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-ink-2)] shadow-[0_2px_8px_rgb(0_0_0/0.14)]"
          >
            {t("report.gpsDenied")}
          </p>
        )}

        <Link
          href="/report"
          data-touch
          className="btn btn-primary press absolute bottom-4 left-1/2 -translate-x-1/2 rounded-[var(--radius-pill)] px-6 text-[var(--text-base)]"
        >
          <svg
            viewBox="0 0 16 16"
            className="size-4"
            aria-hidden="true"
            fill="currentColor"
          >
            <path d="M8 1.6 2.2 12.8h11.6L8 1.6Zm0 3.7 3.4 6.5H4.6L8 5.3Zm-.7 1.9h1.4v2.6H7.3V6.9Zm0 3.2h1.4v1.3H7.3v-1.3Z" />
          </svg>
          {t("map.reportCta")}
        </Link>
      </div>

      <DetailSheet
        selected={selected}
        onClose={() => setSelected(null)}
        onVote={vote}
      />

      <SourceStrip
        counts={data?.meta.counts}
        generatedAt={data?.meta.generatedAt ?? null}
        total={features.length}
      />
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[var(--color-paper-2)]">
      <p className="text-[var(--text-sm)] text-[var(--color-muted)]">
        Loading…
      </p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="divide-y divide-[var(--color-rule-2)]" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-start gap-3 px-4 py-4">
          <span className="mt-1 size-3 shrink-0 rounded-full bg-[var(--color-paper-3)]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/5 rounded bg-[var(--color-paper-3)]" />
            <div className="h-3 w-3/5 rounded bg-[var(--color-paper-3)]" />
          </div>
        </li>
      ))}
    </ul>
  );
}
