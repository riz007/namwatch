'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { rainBandFor } from '@/config/rain-bands.ts';
import { isReport, isStation, type MapFeature } from '@/lib/api/map-types.ts';
import { RainChip, RainGlyph } from '../RainChip.tsx';

/**
 * The headline numbers, above the map.
 *
 * Without this the most important facts are invisible: the heaviest rainfall
 * reading is one of a hundred gauges hidden at city zoom, and the four stations
 * over their banks are four dots among nine hundred. A map you have to hunt
 * through is not situational awareness.
 */
export function SummaryBar({ features }: { features: readonly MapFeature[] }) {
  const t = useTranslations();

  const stats = useMemo(() => {
    let overbank = 0;
    let rising = 0;
    let maxRainMm: number | null = null;
    let deepest = -1;

    for (const { properties: p } of features) {
      if (isStation(p)) {
        if (p.status === 'critical') overbank++;
        else if (p.status === 'warning' || p.status === 'watch') rising++;
        if (p.kind === 'rain' && p.value !== null) {
          maxRainMm = maxRainMm === null ? p.value : Math.max(maxRainMm, p.value);
        }
      } else if (isReport(p)) {
        deepest = Math.max(deepest, p.depthBand);
      }
    }
    return { overbank, rising, maxRainMm, deepest };
  }, [features]);

  const rainBand = rainBandFor(stats.maxRainMm);
  const quiet = stats.overbank === 0 && stats.rising === 0 && (rainBand === null || rainBand === 'none');

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-2">
      {stats.overbank > 0 && (
        <Stat
          tone="depth-5"
          value={stats.overbank}
          label={t('summary.overbank')}
          glyph={
            <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
              <path d="M2 15q3.5-2 7 0t7 0t6 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M2 19.5q3.5-2 7 0t7 0t6 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 3v7M8.6 6.6 12 3l3.4 3.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
      )}

      {stats.rising > 0 && (
        <Stat
          tone="depth-2"
          value={stats.rising}
          label={t('summary.rising')}
          glyph={
            <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
              <path d="M3 17.5 9.5 11l4 4L21 7.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15.5 7.5H21v5.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
      )}

      {rainBand !== null && rainBand !== 'none' && (
        <RainChip band={rainBand} mm={stats.maxRainMm} size="sm" />
      )}

      {quiet && (
        <span className="inline-flex items-center gap-1.5 text-[var(--text-sm)] text-[var(--color-ink-2)]">
          <RainGlyph band="none" className="size-4" />
          {t('summary.quiet')}
        </span>
      )}
    </div>
  );
}

function Stat({
  tone,
  value,
  label,
  glyph,
}: {
  tone: string;
  value: number;
  label: string;
  glyph: React.ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-2 py-1 text-[var(--text-sm)] font-semibold"
      style={{
        backgroundColor: `var(--color-${tone})`,
        color: `var(--color-${tone}-on)`,
        borderColor: `var(--color-${tone}-border)`,
      }}
    >
      {glyph}
      <span className="tabular">{value}</span>
      <span className="font-medium opacity-90">{label}</span>
    </span>
  );
}
