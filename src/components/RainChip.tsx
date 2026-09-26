import { useTranslations } from 'next-intl';
import { rainBandDef, type RainBand } from '@/config/rain-bands.ts';

/** Rain intensity, shown as colour plus an icon plus the reading in words. */
export function RainChip({ band, mm, size = 'md' }: { band: RainBand; mm: number | null; size?: 'sm' | 'md' }) {
  const t = useTranslations();
  const def = rainBandDef(band);
  const light = band === 'none' || band === 'light';

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] border border-black/10 px-1.5 py-1 font-medium ${
        size === 'sm' ? 'text-[var(--text-xs)]' : 'text-[var(--text-sm)]'
      }`}
      style={{
        backgroundColor: `var(--color-${def.token})`,
        color: light ? 'var(--color-rain-on-light)' : 'var(--color-rain-on)',
      }}
    >
      <RainGlyph band={band} className={size === 'sm' ? 'size-4' : 'size-5'} />
      <span>{t(def.labelKey)}</span>
      {mm !== null && <span className="tabular opacity-80">{mm} mm</span>}
    </span>
  );
}

/** Cloud with a increasing number of drops — the second channel after colour. */
export function RainGlyph({ band, className }: { band: RainBand; className?: string }) {
  const drops = { none: 0, light: 1, moderate: 2, heavy: 3, extreme: 4 }[band];

  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M7.2 14.5a3.9 3.9 0 0 1-.3-7.8 5.1 5.1 0 0 1 9.7-1 3.6 3.6 0 0 1 .3 7.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {Array.from({ length: drops }).map((_, i) => (
        <path
          key={i}
          d={`M${6.5 + i * 3.7} ${17.2 + (i % 2) * 1.6}v3`}
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      ))}
      {band === 'none' && (
        <path d="M9.5 19.5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity="0.5" />
      )}
    </svg>
  );
}
