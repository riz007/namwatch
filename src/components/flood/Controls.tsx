"use client";

import { TIME_WINDOWS_H, type TimeWindowH } from "@/config/app.config.ts";
import { DEPTH_BANDS, type DepthBandValue } from "@/config/depth-bands.ts";
import { useTranslations } from "next-intl";
import { DepthPictogram } from "../DepthPictogram.tsx";

/**
 * Map ⇄ List toggle and the filter chips..
 *
 * The toggle gives both views equal visual weight: makes the List
 * a peer of the Map, not a fallback, because it is what people on a cheap phone
 * without working WebGL actually use.
 */
export type View = "map" | "list" | "roads" | "river";

export function ViewToggle({
  view,
  onChange,
}: {
  view: View;
  onChange: (v: View) => void;
}) {
  const t = useTranslations("map");

  return (
    <div role="tablist" aria-label={t("title")} className="segmented">
      {(["map", "list", "roads", "river"] as const).map((value) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={view === value}
          onClick={() => onChange(value)}
          className="press"
        >
          {value === "map" ? (
            <MapGlyph />
          ) : value === "list" ? (
            <ListGlyph />
          ) : value === "roads" ? (
            <RoadGlyph />
          ) : (
            <RiverGlyph />
          )}
          {value === "map"
            ? t("viewMap")
            : value === "list"
              ? t("viewList")
              : value === "roads"
                ? t("viewRoads")
                : t("viewRiver")}
        </button>
      ))}
    </div>
  );
}

const MapGlyph = () => (
  <svg
    viewBox="0 0 16 16"
    className="size-4"
    aria-hidden="true"
    fill="currentColor"
  >
    <path d="M6 1.6 1.5 3.3v11.1L6 12.7l4 1.7 4.5-1.7V1.6L10 3.3 6 1.6Zm0 1.5 3.3 1.4v8.4L6 11.5V3.1Z" />
  </svg>
);

const ListGlyph = () => (
  <svg
    viewBox="0 0 16 16"
    className="size-4"
    aria-hidden="true"
    fill="currentColor"
  >
    <path d="M2 3.4h12v1.7H2V3.4Zm0 3.8h12v1.7H2V7.2Zm0 3.7h12v1.7H2v-1.7Z" />
  </svg>
);

/** Depth ≥ N filter. Renders the pictogram so the chips obey too. */
export function DepthFilter({
  min,
  onChange,
}: {
  min: DepthBandValue;
  onChange: (v: DepthBandValue) => void;
}) {
  const t = useTranslations("depth");

  return (
    <div
      className="flex items-center gap-1.5 pe-1"
      role="group"
      aria-label={t("label")}
    >
      {DEPTH_BANDS.map((b) => {
        const active = min === b.band;
        return (
          <button
            key={b.band}
            type="button"
            aria-pressed={active}
            title={`${t("atLeast", { label: t(`${b.band}.label`) })}`}
            onClick={() => onChange(b.band)}
            className="swatch press"
            style={{
              backgroundColor: `var(--color-${b.token})`,
              color: `var(--color-${b.token}-on)`,
              boxShadow: active
                ? "0 0 0 2.5px var(--color-ink), 0 3px 8px rgb(0 0 0 / 0.28)"
                : `inset 0 0 0 1.5px var(--color-${b.token}-border), 0 1px 2px rgb(0 0 0 / 0.1)`,
            }}
          >
            <DepthPictogram band={b.band} className="size-5" />
            <span className="sr-only">{t(`${b.band}.label`)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TimeFilter({
  hours,
  onChange,
}: {
  hours: TimeWindowH;
  onChange: (v: TimeWindowH) => void;
}) {
  const t = useTranslations("map");

  return (
    <div
      className="flex items-center gap-2"
      role="group"
      aria-label={t("timeWindow")}
    >
      {TIME_WINDOWS_H.map((h) => (
        <button
          key={h}
          type="button"
          aria-pressed={hours === h}
          onClick={() => onChange(h)}
          className={
            "tabular inline-flex min-h-9 items-center whitespace-nowrap rounded-[var(--radius-pill)] border px-3 text-[var(--text-sm)] font-medium transition-colors duration-[var(--dur-fast)] " +
            (hours === h
              ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
              : "border-[var(--color-rule)] text-[var(--color-muted)] hover:text-[var(--color-ink)]")
          }
        >
          {t("lastHours", { hours: h })}
        </button>
      ))}
    </div>
  );
}

/**
 * Who is telling you this: everything, instruments only, or people only.
 *
 * Asked for by a user during the flood — merged on one map, an official gauge
 * and somebody's phone report look like the same kind of claim, and they are
 * not. Shape and a dashed ring separate them at a glance; this separates them
 * outright, for the moment someone needs to act on one and not the other.
 */
export type SourceFilter = "all" | "sensor" | "people";

export function SourceFilterControl({
  value,
  onChange,
}: {
  value: SourceFilter;
  onChange: (v: SourceFilter) => void;
}) {
  const t = useTranslations("source");

  return (
    <div
      className="flex items-center gap-2"
      role="group"
      aria-label={t("label")}
    >
      {(["all", "sensor", "people"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={
            "inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-pill)] border px-3 text-[var(--text-sm)] font-medium transition-colors duration-[var(--dur-fast)] " +
            (value === v
              ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
              : "border-[var(--color-rule)] text-[var(--color-muted)] hover:text-[var(--color-ink)]")
          }
        >
          {v !== "all" && <SourceGlyph kind={v} />}
          {t(v)}
        </button>
      ))}
    </div>
  );
}

/** The same two marks the map uses: hard square, or dashed circle. */
function SourceGlyph({ kind }: { kind: "sensor" | "people" }) {
  return (
    <svg viewBox="0 0 14 14" className="size-3.5" aria-hidden="true">
      {kind === "sensor" ? (
        <rect
          x="2.5"
          y="2.5"
          width="9"
          height="9"
          rx="1.5"
          fill="currentColor"
        />
      ) : (
        <circle
          cx="7"
          cy="7"
          r="4.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="2.6 2"
        />
      )}
    </svg>
  );
}

/** A road narrowing toward the horizon — the tab's own mark, not a list icon. */
function RoadGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      <path
        d="M5.4 14 7 2m3.6 12L9 2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M8 4.6v2.2M8 9.2v2.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="0.1 0"
        fill="none"
      />
    </svg>
  );
}

/** A river's meander, top to bottom — the way the river view reads. */
function RiverGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      <path
        d="M9.5 1.5c-3 2-3 3.8 0 5.5s3 3.5 0 5.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
