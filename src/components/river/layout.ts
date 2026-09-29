import type { RiverDamState, RiverGaugeState } from "@/lib/api/river-types.ts";

/**
 * Turns the river response into the rows the diagram draws.
 *
 * Two rules keep the picture honest:
 *
 * 1. Line width is proportional to the square root of *measured* flow, so the
 *    river visibly narrows or swells where a gauge says it does. A row counts
 *    as measured when its own gauge is flow-rated, or when it sits between two
 *    that are. Below the last flow-rated gauge the width carries on but is
 *    marked unmeasured and drawn fainter: a level-only gauge is not evidence
 *    of how much water is moving.
 *
 * 2. Each dam enters at the gauge where its river actually meets the Chao
 *    Phraya. Pa Sak joins at Ayutthaya, below the Chao Phraya Dam, which is
 *    exactly why its storage matters to Bangkok; drawing every dam at the top
 *    would hide that.
 */
export type RiverRow =
  | {
      kind: "inlet";
      key: string;
      dams: RiverDamState[];
      widthPx: number;
      head: boolean;
    }
  | {
      kind: "gauge";
      key: string;
      gauge: RiverGaugeState;
      widthPx: number;
      measured: boolean;
    };

export const MIN_WIDTH_PX = 4;
export const MAX_WIDTH_PX = 18;
/** Bangkok's 2011 peak at C.13 was about 3,700 m³/s; the scale covers it. */
const SCALE_MAX_M3S = 4000;

export const widthForFlow = (m3s: number): number =>
  Math.round(
    MIN_WIDTH_PX +
      (MAX_WIDTH_PX - MIN_WIDTH_PX) *
        Math.sqrt(Math.min(Math.max(m3s, 0), SCALE_MAX_M3S) / SCALE_MAX_M3S),
  );

export function riverRows(
  gauges: readonly RiverGaugeState[],
  dams: readonly RiverDamState[],
): RiverRow[] {
  const rated = gauges.map((g) => g.dischargeM3s !== null);
  const firstRated = rated.indexOf(true);
  const lastRated = rated.lastIndexOf(true);

  const rows: RiverRow[] = [];
  const placed = new Set<string>();
  let width = MIN_WIDTH_PX;

  gauges.forEach((g, i) => {
    const joining = dams.filter(
      (d) => !placed.has(d.id) && g.placeEn.startsWith(d.joinsEn),
    );
    if (joining.length > 0) {
      joining.forEach((d) => placed.add(d.id));
      rows.push({
        kind: "inlet",
        key: `inlet-${g.externalId}`,
        dams: joining,
        widthPx: width,
        head: i === 0,
      });
    }

    if (g.dischargeM3s !== null) width = widthForFlow(g.dischargeM3s);
    const measured = rated[i]! || (i > firstRated && i < lastRated);
    rows.push({
      kind: "gauge",
      key: g.externalId,
      gauge: g,
      widthPx: width,
      measured: firstRated !== -1 && measured,
    });
  });

  return rows;
}
