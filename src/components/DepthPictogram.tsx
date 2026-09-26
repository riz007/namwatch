import type { DepthBandValue } from '@/config/depth-bands.ts';

/**
 * Depth pictogram: a standing figure with the waterline drawn at the band's
 * height. SPEC §6.1 asks for body pictograms, and Hard rule 22 forbids conveying
 * severity by colour alone — this is the second channel, with the text label
 * as the third.
 *
 * Hand-built SVG (Tier B). The waterline y-values are the figure's real
 * anatomy: ankle, shin, knee, waist, chest — so the glyph reads correctly even
 * at 20 px where the silhouette itself is barely legible.
 */

/** y in a 0–24 viewBox. Lower number = higher up the body. */
const WATERLINE: Record<DepthBandValue, number | null> = {
  0: null, // dry — no water drawn
  1: 21.5, // below ankle
  2: 19, // shin
  3: 16, // knee
  4: 12.5, // waist
  5: 9, // chest
};

export function DepthPictogram({
  band,
  className,
  title,
}: {
  band: DepthBandValue;
  className?: string;
  title?: string;
}) {
  const water = WATERLINE[band];

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      fill="none"
    >
      {/* Ground line — present in every band so the figure is anchored. */}
      <path d="M2 22.6h20" stroke="currentColor" strokeWidth="1" opacity="0.35" />

      {/* Standing figure. */}
      <circle cx="12" cy="4" r="2.35" fill="currentColor" />
      <path
        d="M12 6.9v7.7M12 8.6 8.6 11M12 8.6l3.4 2.4M12 14.6 9.4 22M12 14.6l2.6 7.4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />

      {water !== null && (
        <>
          {/* Water body — semi-opaque so the figure stays readable through it. */}
          <rect x="0" y={water} width="24" height={24 - water} fill="currentColor" opacity="0.28" />
          {/* Waterline, drawn as a wave so it reads as water and not as a rule. */}
          <path
            d={`M0 ${water}q3 -1.4 6 0t6 0t6 0t6 0`}
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      )}

      {band === 0 && (
        /* Dry: a check, so "receded" is affirmative rather than just an absence. */
        <path
          d="M16.6 18.4l1.9 1.9 3.3-3.6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
