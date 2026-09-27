/**
 * Shapes returned by `GET /api/v1/map`. Shared by the route and the client so
 * the two cannot drift. The client never talks to the database;
 * this is the only shape it knows.
 */
import type { ProvenanceLevel } from "@/components/Provenance.tsx";
import type { RainBand } from "@/config/rain-bands.ts";

export type MapFeatureBase = {
  layer: "reports" | "stations" | "external";
  provenance: ProvenanceLevel;
  id: string;
};

export type ReportProps = MapFeatureBase & {
  layer: "reports";
  kind: "road" | "home" | "canal" | "help";
  depthBand: number;
  note: string | null;
  createdAt: string;
  expiresAt: string;
  opacity: number;
  stillCount: number;
  recededCount: number;
  regionId: string | null;
};

export type StationProps = MapFeatureBase & {
  layer: "stations";
  source: string;
  kind: string;
  /** Intensity band for rain gauges, from the 24-hour accumulation. */
  rainBand?: RainBand | null;
  nameTh: string | null;
  nameEn: string | null;
  value: number | null;
  bankLevelM: number | null;
  status: "normal" | "watch" | "warning" | "critical" | "unknown";
  observedAt: string | null;
};

export type ExternalProps = MapFeatureBase & {
  layer: "external";
  source: string;
  kind: string;
  state: string | null;
  description: string | null;
  url: string | null;
  observedAt: string;
  regionId: string | null;
};

export type AnyProps = ReportProps | StationProps | ExternalProps;

export type MapFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: AnyProps;
};

export type MapResponse = {
  type: "FeatureCollection";
  features: MapFeature[];
  meta: {
    bbox: [number, number, number, number];
    sinceHours: number;
    generatedAt: string;
    counts: { reports: number; stations: number; external: number };
    /** When any source last produced data, ignoring the time-window filter. */
    newestAt: string | null;
    staleSources: string[];
    /** Layers that failed. the UI names what is missing. */
    degraded: string[];
  };
};

export const isReport = (p: AnyProps): p is ReportProps =>
  p.layer === "reports";
export const isStation = (p: AnyProps): p is StationProps =>
  p.layer === "stations";
export const isExternal = (p: AnyProps): p is ExternalProps =>
  p.layer === "external";
