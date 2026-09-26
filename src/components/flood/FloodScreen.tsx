'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation.ts';
import { BANGKOK_BBOX, type TimeWindowH } from '@/config/app.config.ts';
import type { DepthBandValue } from '@/config/depth-bands.ts';
import { isReport, type MapFeature } from '@/lib/api/map-types.ts';
import { DepthFilter, TimeFilter, ViewToggle, type View } from './Controls.tsx';
import { FloodList } from './FloodList.tsx';
import { SourceStrip } from './SourceStrip.tsx';
import { useFloodData } from './useFloodData.ts';

/**
 * Screen 1 — Map + List (SPEC §8.3).
 *
 * Macrostructure: Map / Diagram. The map is the composition; everything else is
 * orientation around it.
 *
 * The map chunk is lazy so the initial bundle stays under the Hard rule 24
 * budget, and so the List view costs nothing on a phone that will never render
 * WebGL.
 */
const MapCanvas = dynamic(() => import('./MapCanvas.tsx').then((m) => m.MapCanvas), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export function FloodScreen() {
  const t = useTranslations();
  const [view, setView] = useState<View>('map');
  const [minDepth, setMinDepth] = useState<DepthBandValue>(0);
  const [hours, setHours] = useState<TimeWindowH>(12);

  const { data, error, isLoading } = useFloodData(BANGKOK_BBOX, hours);

  const features = useMemo<MapFeature[]>(() => {
    if (!data) return [];
    if (minDepth === 0) return data.features;
    // Depth filters crowd reports; stations and Traffy items have no band, and
    // hiding them because they lack one would silently drop official data.
    return data.features.filter((f) => !isReport(f.properties) || f.properties.depthBand >= minDepth);
  }, [data, minDepth]);

  return (
    <div className="flex min-h-[calc(100dvh-96px)] flex-col">
      {/* Orientation row — the Map/Diagram macrostructure's small heading beside
          the composition, not a hero above it. */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <h1 className="sr-only">{t('map.title')}</h1>
        <div className="min-w-[180px] flex-1">
          <ViewToggle view={view} onChange={setView} />
        </div>
        <TimeFilter hours={hours} onChange={setHours} />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto px-4 pb-2">
        <span className="shrink-0 text-[var(--text-xs)] font-medium text-[var(--color-muted)]">
          {t('depth.label')}
        </span>
        <DepthFilter min={minDepth} onChange={setMinDepth} />
      </div>

      {error && (
        <div
          role="alert"
          className="mx-4 mb-2 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-3 py-2 text-[var(--text-sm)]"
        >
          <span className="text-[var(--color-ink)]">{t('map.error')}</span>
          <span className="text-[var(--color-muted)]">{t('error.network')}</span>
        </div>
      )}

      {/* Hard rule 5: name the layer that is missing rather than quietly showing less. */}
      {data?.meta.degraded && data.meta.degraded.length > 0 && (
        <div
          role="status"
          className="mx-4 mb-2 rounded-[var(--radius-md)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-ink-2)]"
        >
          {t('freshness.delayed')} · {data.meta.degraded.join(', ')}
        </div>
      )}

      <div className="relative min-h-[420px] flex-1 border-y border-[var(--color-rule)]">
        {view === 'map' ? (
          isLoading && !data ? (
            <MapSkeleton />
          ) : (
            <MapCanvas features={features} />
          )
        ) : (
          // pb-20 keeps the last rows clear of the floating report button.
          <div className="absolute inset-0 overflow-y-auto pb-20">
            {isLoading && !data ? <ListSkeleton /> : <FloodList features={features} />}
          </div>
        )}

        {/* SPEC §8.1: the primary action sits in the bottom thumb zone. */}
        <Link
          href="/report"
          data-touch
          className="absolute bottom-4 left-1/2 inline-flex min-h-[var(--size-touch)] -translate-x-1/2 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-5 text-[var(--text-base)] font-semibold text-[var(--color-accent-ink)] shadow-[0_2px_10px_rgb(0_0_0/0.18)] transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)] active:translate-y-px"
        >
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true" fill="currentColor">
            <path d="M8 1.6 2.2 12.8h11.6L8 1.6Zm0 3.7 3.4 6.5H4.6L8 5.3Zm-.7 1.9h1.4v2.6H7.3V6.9Zm0 3.2h1.4v1.3H7.3v-1.3Z" />
          </svg>
          {t('map.reportCta')}
        </Link>
      </div>

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
      <p className="text-[var(--text-sm)] text-[var(--color-muted)]">Loading…</p>
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
