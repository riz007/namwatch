'use client';

import { useTranslations } from 'next-intl';
import { DEPTH_BANDS, type DepthBandValue } from '@/config/depth-bands.ts';
import { TIME_WINDOWS_H, type TimeWindowH } from '@/config/app.config.ts';
import { DepthPictogram } from '../DepthPictogram.tsx';

/**
 * Map ⇄ List toggle and the filter chips..
 *
 * The toggle gives both views equal visual weight: makes the List
 * a peer of the Map, not a fallback, because it is what people on a cheap phone
 * without working WebGL actually use.
 */
export type View = 'map' | 'list';

export function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const t = useTranslations('map');

  return (
    <div
      role="tablist"
      aria-label={t('title')}
      className="grid grid-cols-2 rounded-[var(--radius-md)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-0.5"
    >
      {(['map', 'list'] as const).map((value) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={view === value}
          onClick={() => onChange(value)}
          className={
            'inline-flex min-h-[calc(var(--size-touch)-8px)] items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-sm)] text-[var(--text-sm)] font-semibold transition-colors duration-[var(--dur-fast)] ' +
            (view === value
              ? 'bg-[var(--color-paper)] text-[var(--color-ink)] shadow-[0_1px_2px_rgb(0_0_0/0.08)]'
              : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]')
          }
        >
          {value === 'map' ? <MapGlyph /> : <ListGlyph />}
          {value === 'map' ? t('viewMap') : t('viewList')}
        </button>
      ))}
    </div>
  );
}

const MapGlyph = () => (
  <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true" fill="currentColor">
    <path d="M6 1.6 1.5 3.3v11.1L6 12.7l4 1.7 4.5-1.7V1.6L10 3.3 6 1.6Zm0 1.5 3.3 1.4v8.4L6 11.5V3.1Z" />
  </svg>
);

const ListGlyph = () => (
  <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true" fill="currentColor">
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
  const t = useTranslations('depth');

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('label')}>
      {DEPTH_BANDS.map((b) => {
        const active = min === b.band;
        return (
          <button
            key={b.band}
            type="button"
            aria-pressed={active}
            title={`${t('atLeast', { label: t(`${b.band}.label`) })}`}
            onClick={() => onChange(b.band)}
            className={
              'inline-flex size-10 min-h-0 items-center justify-center rounded-[var(--radius-sm)] transition-transform duration-[var(--dur-fast)] ' +
              (active ? 'scale-110' : 'hover:scale-105')
            }
            style={{
              backgroundColor: `var(--color-${b.token})`,
              color: `var(--color-${b.token}-on)`,
              boxShadow: active
                ? '0 0 0 2px var(--color-ink), 0 1px 4px rgb(0 0 0 / 0.25)'
                : `inset 0 0 0 1px var(--color-${b.token}-border)`,
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
  const t = useTranslations('map');

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('timeWindow')}>
      {TIME_WINDOWS_H.map((h) => (
        <button
          key={h}
          type="button"
          aria-pressed={hours === h}
          onClick={() => onChange(h)}
          className={
            'tabular inline-flex min-h-9 items-center whitespace-nowrap rounded-[var(--radius-pill)] border px-3 text-[var(--text-sm)] font-medium transition-colors duration-[var(--dur-fast)] ' +
            (hours === h
              ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
              : 'border-[var(--color-rule)] text-[var(--color-muted)] hover:text-[var(--color-ink)]')
          }
        >
          {t('lastHours', { hours: h })}
        </button>
      ))}
    </div>
  );
}
