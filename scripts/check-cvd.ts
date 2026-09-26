/**
 * Validates the depth-band colour ramp.
 *
 * Asserts, for both light and dark themes:
 * 1. Lightness (CIE L*) decreases strictly across bands 1..5, so the ramp is
 * readable as a sequence even with no colour perception at all.
 * 2. Adjacent bands stay perceptually separated (CIEDE2000) under normal vision
 * and under simulated protanopia, deuteranopia and tritanopia.
 * 3. Band 0 ("dry") is clearly distinct from every severity band, since it means
 * the opposite thing.
 * 4. Each band's `on` colour meets WCAG 2.2 AA (4.5:1) against its background.
 *
 * Colour-vision simulation uses the Viénot–Brettel–Mollon (1999) LMS projection.
 * Run with `pnpm check:cvd`. CI runs it, so a hex edit that breaks the scale fails.
 */
import { DEPTH_BANDS } from '../src/config/depth-bands.ts';

type RGB = [number, number, number];
type Theme = 'light' | 'dark';

/**
 * Thresholds. Lightness does the ordering work — it is the one channel every
 * dichromat retains — so the L* step is the strict gate. ΔE00 then only has to
 * prove adjacent bands are not literally the same swatch; ~10 is a solid target
 * for discriminating large map areas (a just-noticeable difference is ~2-3).
 * Band 0 means the opposite of the ramp, so it is held to a wider margin.
 */
// calibrated against reference sequential palettes measured with this same code:
// ColorBrewer YlOrRd-5 reaches 8.5 under deuteranopia, YlOrBr-5 10.9, Reds-5 10.8.
// 10 therefore sits at the strict end of what a real hazard ramp achieves.
const MIN_ADJACENT_DE = 10;
const MIN_BAND0_DE = 20;
const MIN_L_STEP = 8;
const MIN_CONTRAST = 4.5;
/**
 * WCAG 2.2 SC 1.4.11 (non-text contrast): a band swatch is a graphical object
 * conveying information, so it needs 3:1 against the surface behind it.
 */
const MIN_SURFACE_CONTRAST = 3;
const SURFACE = { light: '#FFFFFF', dark: '#121417' } as const;

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number): number =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(c, 0) ** (1 / 2.4) - 0.055;

function relativeLuminance([r, g, b]: RGB): number {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrastRatio(a: RGB, b: RGB): number {
  const [la, lb] = [relativeLuminance(a), relativeLuminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Linear sRGB → CIE XYZ (D65). */
function rgbToXyz([r, g, b]: RGB): RGB {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  return [
    0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb,
    0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb,
    0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb,
  ];
}

/** CIE XYZ (D65) → CIELAB. */
function xyzToLab([x, y, z]: RGB): RGB {
  const [xn, yn, zn] = [0.95047, 1.0, 1.08883];
  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const [fx, fy, fz] = [f(x / xn), f(y / yn), f(z / zn)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const labOf = (rgb: RGB): RGB => xyzToLab(rgbToXyz(rgb));

/** CIEDE2000 colour difference. */
function ciede2000(lab1: RGB, lab2: RGB): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hp = (b: number, ap: number): number => {
    if (b === 0 && ap === 0) return 0;
    const deg = Math.atan2(b, ap) / rad;
    return deg >= 0 ? deg : deg + 360;
  };
  const h1p = hp(b1, a1p);
  const h2p = hp(b2, a2p);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbp += h1p + h2p < 360 ? 360 : -360;
    hbp /= 2;
  }
  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * rad) +
    0.24 * Math.cos(2 * hbp * rad) +
    0.32 * Math.cos((3 * hbp + 6) * rad) -
    0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh),
  );
}

/** Viénot, Brettel & Mollon (1999) dichromat simulation in LMS space. */
function simulate(rgb: RGB, kind: 'protan' | 'deutan' | 'tritan'): RGB {
  const [r, g, b] = [toLinear(rgb[0]), toLinear(rgb[1]), toLinear(rgb[2])];
  // Hunt-Pointer-Estevez (D65-normalised) RGB → LMS
  const L = 0.31399022 * r + 0.63951294 * g + 0.04649755 * b;
  const M = 0.15537241 * r + 0.75789446 * g + 0.08670142 * b;
  const S = 0.01775239 * r + 0.10944209 * g + 0.87256922 * b;
  let [L2, M2, S2] = [L, M, S];
  if (kind === 'protan') L2 = 1.05118294 * M - 0.05116099 * S;
  else if (kind === 'deutan') M2 = 0.9513092 * L + 0.04866992 * S;
  else S2 = -0.86744736 * L + 1.86727089 * M;
  const r2 = 5.47221206 * L2 - 4.6419601 * M2 + 0.16963708 * S2;
  const g2 = -1.1252419 * L2 + 2.29317094 * M2 - 0.1678952 * S2;
  const b2 = 0.02980165 * L2 - 0.19318073 * M2 + 1.16364789 * S2;
  const clamp = (c: number): number => Math.min(1, Math.max(0, toSrgb(c)));
  return [clamp(r2), clamp(g2), clamp(b2)];
}

const VISIONS = ['normal', 'protan', 'deutan', 'tritan'] as const;
const failures: string[] = [];
const rows: string[] = [];

for (const theme of ['light', 'dark'] as Theme[]) {
  const bands = DEPTH_BANDS.map((b) => ({ band: b.band, rgb: hexToRgb(b.color[theme]) }));

  // 1. Lightness decreases strictly across the severity ramp (bands 1..5).
  const severity = bands.filter((b) => b.band >= 1);
  for (let i = 0; i < severity.length - 1; i++) {
    const a = severity[i]!;
    const z = severity[i + 1]!;
    const [la, lz] = [labOf(a.rgb)[0], labOf(z.rgb)[0]];
    const step = la - lz;
    rows.push(`${theme} L* depth-${a.band}=${la.toFixed(1)} → depth-${z.band}=${lz.toFixed(1)}`);
    if (step < MIN_L_STEP) {
      failures.push(
        `${theme}: lightness step depth-${a.band}→depth-${z.band} is ${step.toFixed(1)}, need >= ${MIN_L_STEP}`,
      );
    }
  }

  for (const vision of VISIONS) {
    const seen = bands.map((b) => ({
      band: b.band,
      lab: labOf(vision === 'normal' ? b.rgb : simulate(b.rgb, vision)),
    }));

    // 2. Adjacent severity bands stay separated.
    for (let i = 1; i < seen.length - 1; i++) {
      const a = seen[i]!;
      const z = seen[i + 1]!;
      const de = ciede2000(a.lab, z.lab);
      if (de < MIN_ADJACENT_DE) {
        failures.push(
          `${theme}/${vision}: depth-${a.band} vs depth-${z.band} ΔE=${de.toFixed(1)}, need >= ${MIN_ADJACENT_DE}`,
        );
      }
    }

    // 3. "Dry" must never be mistaken for a severity band.
    const dry = seen[0]!;
    for (const other of seen.slice(1)) {
      const de = ciede2000(dry.lab, other.lab);
      if (de < MIN_BAND0_DE) {
        failures.push(
          `${theme}/${vision}: depth-0 vs depth-${other.band} ΔE=${de.toFixed(1)}, need >= ${MIN_BAND0_DE}`,
        );
      }
    }
  }

  // 3b. Every band swatch must stand out from the surface it sits on. A pale fill
  // cannot do this alone, so the border is what has to clear the bar.
  for (const b of DEPTH_BANDS) {
    const ratio = contrastRatio(hexToRgb(b.border[theme]), hexToRgb(SURFACE[theme]));
    if (ratio < MIN_SURFACE_CONTRAST) {
      failures.push(
        `${theme}: depth-${b.band} border vs surface ${SURFACE[theme]} is ${ratio.toFixed(2)}:1, need >= ${MIN_SURFACE_CONTRAST}:1`,
      );
    }
  }

  // 4. Text on each band meets WCAG AA.
  for (const b of DEPTH_BANDS) {
    const ratio = contrastRatio(hexToRgb(b.color[theme]), hexToRgb(b.on[theme]));
    if (ratio < MIN_CONTRAST) {
      failures.push(
        `${theme}: depth-${b.band} text contrast ${ratio.toFixed(2)}:1, need >= ${MIN_CONTRAST}:1`,
      );
    }
  }
}

console.log(rows.join('\n'));
if (failures.length > 0) {
  console.error(`\n✗ depth-band ramp failed ${failures.length} check(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\n✓ depth-band ramp passes lightness, CVD separation and contrast checks');
