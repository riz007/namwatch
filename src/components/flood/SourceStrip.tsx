"use client";

import { useTranslations } from "next-intl";
import { Freshness } from "../Freshness.tsx";
import { ProvenanceMark } from "../Provenance.tsx";

/**
 * Attribution and freshness strip. This app screen has no marketing footer —
 * this is what sits at the foot instead.
 *
 * Attribution is shown on the map, in Thai agency names and English.
 * It cannot be styled into invisibility, so it
 * renders at real body size with the provenance key spelled out.
 */
export function SourceStrip({
  counts,
  generatedAt,
  total,
}: {
  counts?: { reports: number; stations: number; external: number };
  generatedAt: string | null;
  total: number;
}) {
  const t = useTranslations();

  return (
    <footer className="space-y-1.5 px-4 py-3 text-[var(--text-xs)] text-[var(--color-muted)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="tabular font-medium text-[var(--color-ink-2)]">
          {t("list.count", { count: total })}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ProvenanceMark level="official_sensor" className="size-2.5" />
          {t("provenance.officialSensor")}
          {counts && <span className="tabular">({counts.stations})</span>}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ProvenanceMark level="official_channel" className="size-2.5" />
          {t("provenance.officialChannel")}
          {counts && <span className="tabular">({counts.external})</span>}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ProvenanceMark level="crowd" className="size-2.5" />
          {t("provenance.crowd")}
          {counts && <span className="tabular">({counts.reports})</span>}
        </span>
      </div>

      <p className="flex flex-wrap items-center gap-x-2">
        <span>{t("provenance.source")}:</span>
        <span>สสน. (HII) · Traffy Fondue (กทม. × เนคเทค)</span>
        <span aria-hidden="true">·</span>
        <Freshness at={generatedAt} />
      </p>

      {/* Licence attribution for the base map. Required, so it lives here where
          it is always visible rather than behind an (i) on the map itself. */}
      <p>{t("map.attribution")}</p>
    </footer>
  );
}
