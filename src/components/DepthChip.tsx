import { useTranslations } from 'next-intl';
import { depthBand, type DepthBandValue } from '@/config/depth-bands.ts';
import { DepthPictogram } from './DepthPictogram.tsx';

/**
 * The canonical depth indicator. / colour + pictogram +
 * text, always all three. Nothing else in the app may render a depth band.
 *
 * The border is not decoration — a pale fill cannot reach WCAG 2.2 SC 1.4.11
 * non-text contrast on its own, so the border is what carries it.
 */
export function DepthChip({
  band,
  size = 'md',
  showRange = false,
}: {
  band: DepthBandValue;
  size?: 'sm' | 'md';
  showRange?: boolean;
}) {
  const t = useTranslations('depth');
  const def = depthBand(band);

  const glyph = size === 'sm' ? 'size-4' : 'size-5';
  const text = size === 'sm' ? 'text-[var(--text-xs)]' : 'text-[var(--text-sm)]';

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] border px-1.5 py-1 font-medium ${text}`}
      style={{
        backgroundColor: `var(--color-${def.token})`,
        color: `var(--color-${def.token}-on)`,
        borderColor: `var(--color-${def.token}-border)`,
      }}
    >
      <DepthPictogram band={band} className={`${glyph} shrink-0`} />
      <span>{t(`${band}.label`)}</span>
      {showRange && <span className="opacity-75">· {t(`${band}.range`)}</span>}
    </span>
  );
}
