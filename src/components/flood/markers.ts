import { DEPTH_BANDS } from "@/config/depth-bands.ts";
import { rainBandDef, type RainBand } from "@/config/rain-bands.ts";
import {
  isExternal,
  isReport,
  isStation,
  type AnyProps,
  type MapFeature,
} from "@/lib/api/map-types.ts";
import Supercluster from "supercluster";

/**
 * How each datum is drawn.
 *
 * Layers are clustered separately and some are never clustered at all. Mixing
 * them into one index — which is the obvious thing to do — produces neutral
 * bubbles that hide the only markers that matter: a station reading over its
 * bank disappears into a count alongside two hundred complaints.
 */
export type Layer = "alarm" | "crowd" | "channel" | "gauge";

export const LAYER_OF = (p: AnyProps): Layer => {
  if (isStation(p)) {
    if (p.status === "critical" || p.status === "warning") return "alarm";
    return "gauge";
  }
  if (isReport(p)) return "crowd";
  return "channel";
};

/**
 * Quiet layers only appear once the viewer has zoomed in far enough for them to
 * mean something. At city scale a field of 150 rain gauges is visual noise that
 * buries the alarms; the rainfall summary above the map carries that signal
 * instead.
 */
export const GAUGE_MIN_ZOOM = 11.5;

/** Alarms are never clustered — they are the reason to look at the map. */
export const CLUSTERED: Record<Layer, boolean> = {
  alarm: false,
  crowd: true,
  channel: true,
  gauge: true,
};

export type ClusterSummary = {
  count: number;
  /** Worst depth band in the cluster, for crowd clusters. */
  maxDepth: number;
  /** Whether any member is an alarm. */
  hasAlarm: boolean;
};

export function buildIndex(
  features: readonly MapFeature[],
): Supercluster<AnyProps, ClusterSummary> {
  const index = new Supercluster<AnyProps, ClusterSummary>({
    radius: 58,
    maxZoom: 16,
    minPoints: 4,
    map: (props): ClusterSummary => ({
      count: 1,
      maxDepth: isReport(props as AnyProps)
        ? (props as { depthBand: number }).depthBand
        : -1,
      hasAlarm: LAYER_OF(props as AnyProps) === "alarm",
    }),
    reduce: (acc, cur): void => {
      acc.count += cur.count;
      acc.maxDepth = Math.max(acc.maxDepth, cur.maxDepth);
      acc.hasAlarm = acc.hasAlarm || cur.hasAlarm;
    },
  });

  index.load(
    features.map((f) => ({
      type: "Feature" as const,
      geometry: f.geometry,
      properties: f.properties,
    })),
  );
  return index;
}

/**
 * The depth band a datum is comparable to, so one filter can act on all of them.
 *
 * Without this the depth filter only touched crowd reports and did nothing at
 * all until somebody had filed one — a control that appears to work and does
 * not is worse than no control.
 *
 * `null` means the datum has no water-depth severity (a rain gauge, or a
 * station with no current reading) and is therefore excluded by any filter
 * above zero.
 */
export function severityBandOf(p: AnyProps): number | null {
  if (isReport(p)) return p.depthBand;
  if (isStation(p)) {
    if (p.kind === "rain") return null;
    switch (p.status) {
      case "critical":
        return 5;
      case "warning":
        return 3;
      case "watch":
        return 2;
      case "normal":
        return 0;
      default:
        return null;
    }
  }
  // A filed complaint reports flooding but not how deep, so treat it as the
  // shallowest positive band rather than dropping or overstating it.
  return 1;
}

export type MarkerStyle = {
  className: string;
  background?: string;
  borderColor?: string;
  color?: string;
  opacity?: number;
  label?: string;
  title: string;
};

/** The visual treatment for a single point. */
export function styleFor(p: AnyProps, locale: string): MarkerStyle {
  const layer = LAYER_OF(p);

  if (layer === "alarm" && isStation(p)) {
    // Map the station's status onto the shared depth ramp, so an overbank canal
    // and a deep road report read at the same severity.
    const token = p.status === "critical" ? "depth-5" : "depth-3";
    return {
      className: `nw-shape nw-alarm${p.status === "critical" ? " nw-alarm-critical" : ""}`,
      background: `var(--color-${token})`,
      borderColor: "var(--color-paper)",
      title: `${(locale === "th" ? p.nameTh : p.nameEn) ?? p.id} · ${p.value ?? "?"} m`,
    };
  }

  if (isReport(p)) {
    const band = DEPTH_BANDS[p.depthBand] ?? DEPTH_BANDS[0]!;
    return {
      className: "nw-shape nw-crowd",
      background: `var(--color-${band.token})`,
      borderColor: `var(--color-${band.token}-border)`,
      // Drives the dashed ring, which is what says "a person typed this in"
      // rather than "an instrument measured it". Severity keeps the hue.
      color: `var(--color-${band.token}-border)`,
      opacity: Math.max(0.45, p.opacity),
      title: p.note ?? p.kind,
    };
  }

  if (isStation(p) && p.kind === "rain" && p.rainBand) {
    return {
      className: "nw-shape nw-rain",
      background: `var(--color-${rainBandDef(p.rainBand as RainBand).token})`,
      title: `${(locale === "th" ? p.nameTh : p.nameEn) ?? p.id} · ${p.value ?? "?"} mm`,
    };
  }

  if (isStation(p)) {
    return {
      className: "nw-shape nw-sensor",
      background: "var(--color-paper-2)",
      borderColor: "var(--color-ink-2)",
      opacity: 0.85,
      title: (locale === "th" ? p.nameTh : p.nameEn) ?? p.id,
    };
  }

  return {
    className: "nw-shape nw-channel",
    title: isExternal(p) ? (p.description ?? p.source) : "report",
  };
}

/**
 * The visual treatment for a cluster.
 *
 * A cluster is coloured by the worst thing inside it. A neutral bubble is a
 * lie of omission: it says "four things" when one of them is knee-deep water.
 */
export function clusterStyle(
  layer: Layer,
  summary: ClusterSummary,
): MarkerStyle {
  const size = Math.min(46, 24 + Math.log2(Math.max(summary.count, 2)) * 4.5);
  // Complaint clusters grow more slowly: they are numerous and non-urgent, and
  // at full scale a count of 358 dwarfs a station that is over its bank.
  const quietSize = Math.min(
    34,
    20 + Math.log2(Math.max(summary.count, 2)) * 2.4,
  );

  if (layer === "crowd" && summary.maxDepth >= 0) {
    const band = DEPTH_BANDS[summary.maxDepth] ?? DEPTH_BANDS[0]!;
    return {
      className: "nw-cluster nw-cluster-crowd nw-from-people",
      background: `var(--color-${band.token})`,
      borderColor: `var(--color-${band.token}-border)`,
      color: `var(--color-${band.token}-on)`,
      label: String(summary.count),
      title: `${summary.count}`,
      opacity: size,
    };
  }

  if (layer === "channel") {
    return {
      className: "nw-cluster nw-cluster-channel",
      label: String(summary.count),
      title: `${summary.count}`,
      opacity: quietSize,
    };
  }

  return {
    className: "nw-cluster nw-cluster-gauge",
    label: String(summary.count),
    title: `${summary.count}`,
    opacity: size,
  };
}
