"use client";

import { isDepthBand } from "@/config/depth-bands.ts";
import { isReport, type MapFeature } from "@/lib/api/map-types.ts";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { DepthChip } from "../DepthChip.tsx";
import { Freshness } from "../Freshness.tsx";
import { groupByRoad, passableForBand, type RoadGroup } from "./roads.ts";

/**
 * Roads and areas, worst water first.
 *
 * The honest framing matters more than the layout here: this is "what has been
 * reported at this place", not "this road is closed". We have no road geometry
 * from any source, so a closure is not ours to declare — and during a flood a
 * wrong closure sends people the long way round or, worse, reassures them.
 */
export function RoadList({
  features,
  onSelect,
}: {
  features: readonly MapFeature[];
  onSelect?: (selected: {
    props: MapFeature["properties"];
    lon: number;
    lat: number;
  }) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const groups = useMemo(
    () => groupByRoad(features, locale),
    [features, locale],
  );

  if (groups.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="font-semibold text-[var(--color-ink)]">
          {t("roads.empty")}
        </p>
        <p className="mx-auto max-w-[36ch] pt-1 text-[var(--text-sm)] leading-relaxed text-[var(--color-muted)]">
          {t("roads.emptyWhy")}
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="px-4 pt-3 pb-2 text-[var(--text-xs)] leading-relaxed text-[var(--color-muted)]">
        {t("roads.caveat")}
      </p>
      <ul className="divide-y divide-[var(--color-rule-2)]">
        {groups.map((g, i) => (
          <li
            key={g.id}
            className="ink-on"
            style={{ animationDelay: `${Math.min(i, 8) * 28}ms` }}
          >
            <Group group={g} onSelect={onSelect} />
          </li>
        ))}
      </ul>
    </>
  );
}

function Group({
  group: g,
  onSelect,
}: {
  group: RoadGroup;
  onSelect?: (selected: {
    props: MapFeature["properties"];
    lon: number;
    lat: number;
  }) => void;
}) {
  const t = useTranslations();
  // Open the deepest point in the group, which is the one worth looking at.
  const bandOf = (f: MapFeature): number =>
    isReport(f.properties) ? f.properties.depthBand : -1;
  const worst = g.features.reduce((a, b) => (bandOf(a) >= bandOf(b) ? a : b));

  // Spec-owned mapping from the worst band; a group is only as passable as its
  // deepest point. What reporters saw is shown separately, as observation.
  const passable = passableForBand(g.worstBand);

  return (
    <button
      type="button"
      onClick={() =>
        onSelect?.({
          props: worst.properties,
          lon: worst.geometry.coordinates[0],
          lat: worst.geometry.coordinates[1],
        })
      }
      className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-[var(--color-paper-2)]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-semibold text-[var(--color-ink)]">
            {g.name}
          </span>
          {g.districtName && (
            <span className="text-[var(--text-xs)] text-[var(--color-muted)]">
              {g.districtName}
            </span>
          )}
          {!g.named && (
            // Say plainly that this is an area, not a road, or the reader will
            // assume we know more about the location than we do.
            <span className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-rule)] px-1.5 py-0.5 text-[var(--text-xs)] text-[var(--color-muted)]">
              {t("roads.areaOnly")}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1.5">
          {isDepthBand(g.worstBand) ? (
            <DepthChip band={g.worstBand} size="sm" />
          ) : (
            <span className="text-[var(--text-sm)] text-[var(--color-muted)]">
              {t("roads.depthUnknown")}
            </span>
          )}
          <Passability vehicles={passable} known={g.worstBand !== null} />
        </div>

        {g.observedPassable.length > 0 && (
          <p className="pt-1 text-[var(--text-xs)] text-[var(--color-ink-2)]">
            {t("roads.observed", {
              vehicles: g.observedPassable
                .map((v) => t(`vehicle.${v}`))
                .join(", "),
            })}
          </p>
        )}

        <div className="tabular flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-1.5 text-[var(--text-xs)] text-[var(--color-muted)]">
          <span>
            {t("roads.counts", {
              people: g.fromPeople,
              sensors: g.fromSensors,
            })}
          </span>
          <span aria-hidden="true" className="text-[var(--color-rule)]">
            ·
          </span>
          <Freshness at={g.newestAt} />
        </div>
      </div>

      <svg
        viewBox="0 0 16 16"
        className="mt-1 size-4 shrink-0 fill-current text-[var(--color-muted)]"
        aria-hidden="true"
      >
        <path d="M6 3.2 10.8 8 6 12.8 4.9 11.7 8.6 8 4.9 4.3Z" />
      </svg>
    </button>
  );
}

/** What can still get through — colour is never the only cue. */
function Passability({
  vehicles,
  known,
}: {
  vehicles: readonly string[];
  known: boolean;
}) {
  const t = useTranslations();
  if (!known) return null;

  const impassable = vehicles.length === 0 || vehicles[0] === "none";

  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-1.5 py-1 text-[var(--text-xs)] font-medium " +
        (impassable
          ? "border-[var(--color-depth-5-border)] bg-[var(--color-depth-5)] text-[var(--color-depth-5-on)]"
          : "border-[var(--color-rule)] text-[var(--color-ink-2)]")
      }
    >
      {impassable ? <BlockedGlyph /> : <PassGlyph />}
      {impassable
        ? t("roads.impassable")
        : t("roads.passable", {
            vehicles: vehicles.map((v) => t(`vehicle.${v}`)).join(", "),
          })}
    </span>
  );
}

function PassGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5 fill-current"
      aria-hidden="true"
    >
      <path d="M6.4 11.6 3 8.2l1.1-1.1 2.3 2.3 5.5-5.5L13 5Z" />
    </svg>
  );
}

function BlockedGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5 fill-current"
      aria-hidden="true"
    >
      <path d="M8 1.6a6.4 6.4 0 1 0 0 12.8A6.4 6.4 0 0 0 8 1.6Zm0 1.6c1 0 2 .3 2.8.9l-6.3 6.3A4.8 4.8 0 0 1 8 3.2Zm0 9.6c-1 0-2-.3-2.8-.9l6.3-6.3A4.8 4.8 0 0 1 8 12.8Z" />
    </svg>
  );
}
