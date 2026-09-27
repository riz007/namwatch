"use client";

import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
// Scoped to this lazy chunk, so it never reaches the initial bundle.
import { BANGKOK_BBOX } from "@/config/app.config.ts";
import type { AnyProps, MapFeature } from "@/lib/api/map-types.ts";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  buildIndex,
  CLUSTERED,
  clusterStyle,
  GAUGE_MIN_ZOOM,
  LAYER_OF,
  styleFor,
  type ClusterSummary,
  type Layer,
} from "./markers.ts";

/**
 * MapLibre GL + OpenFreeMap vector tiles.
 *
 * Loaded through next/dynamic by the screen, so neither maplibre-gl nor its CSS
 * touches the initial bundle.
 *
 * Markers are DOM elements rather than a GL symbol layer: at Bangkok scale there
 * are only a few hundred, and DOM markers inherit the same depth tokens the List
 * uses, so the two views cannot disagree about what a band looks like.
 */
/**
 * Dark mode exists because people check at night
 * during outages, on battery. A bright white basemap would defeat both reasons,
 * so the basemap follows the colour scheme.
 */
const STYLE_URL = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

function prefersDark(): boolean {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark") return true;
  if (attr === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function MapCanvas({
  features,
  focus,
  onSelect,
}: {
  features: readonly MapFeature[];
  /** When set, the map centres here and marks the spot. */
  focus?: { lon: number; lat: number; accuracyM: number } | null;
  /** Opens the detail view for a single marker. */
  onSelect?: (selected: { props: AnyProps; lon: number; lat: number }) => void;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const [scheme, setScheme] = useState<"light" | "dark">("light");
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const locale = useLocale();
  // Held in a ref so a new callback identity does not tear down every marker.
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);
  const t = useTranslations("map");

  // Follow the viewer's colour scheme, including live changes.
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = (): void => setScheme(prefersDark() ? "dark" : "light");
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Create the map. Re-created when the locale or the colour scheme changes,
  // since both are baked into the style.
  useEffect(() => {
    if (!container.current || map.current) return;
    let cancelled = false;

    void (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !container.current) return;

      // MapLibre 6 spawns its tile-parsing worker from a module URL that
      // turbopack cannot resolve, so the map renders blank while still fetching
      // tiles. Point it at the copy in /public (kept in step by
      // `pnpm sync:map-worker`). Works identically in production, any bundler.
      maplibre.setWorkerUrl("/maplibre-gl-worker.mjs");

      const instance = new maplibre.Map({
        container: container.current,
        style: STYLE_URL[scheme],
        bounds: [
          [BANGKOK_BBOX[0], BANGKOK_BBOX[1]],
          [BANGKOK_BBOX[2], BANGKOK_BBOX[3]],
        ],
        fitBoundsOptions: { padding: 24 },
        // No in-map attribution control: the OpenFreeMap and OpenStreetMap
        // credits sit in the SourceStrip directly below the map, always visible
        // rather than hidden behind an (i).
        attributionControl: false,
        maxPitch: 0,
        pitchWithRotate: false,
      });

      // Zoom sits top-right
      // primary action.
      instance.addControl(
        new maplibre.NavigationControl({ showCompass: false }),
        "top-right",
      );

      instance.on("load", () => {
        // Labels follow the UI locale via OSM's own name:th / name:en.
        const field =
          locale === "th"
            ? ["coalesce", ["get", "name:th"], ["get", "name"]]
            : ["coalesce", ["get", "name:en"], ["get", "name"]];
        for (const layer of instance.getStyle().layers ?? []) {
          if (
            layer.type === "symbol" &&
            layer.layout &&
            "text-field" in layer.layout
          ) {
            try {
              instance.setLayoutProperty(
                layer.id,
                "text-field",
                field as never,
              );
            } catch {
              // A style layer we cannot relabel is not worth failing the map for.
            }
          }
        }
      });

      map.current = instance;
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [locale, scheme]);

  // Re-render markers when the data changes, and on every viewport change so
  // clusters re-form at the new zoom.
  useEffect(() => {
    let cancelled = false;
    let detach: (() => void) | undefined;

    void (async () => {
      const maplibre = await import("maplibre-gl");
      const instance = map.current;
      if (cancelled || !instance) return;

      // One index per layer. Clustering across layers would fold a station
      // reading over its bank into a count beside two hundred complaints.
      const byLayer = new Map<Layer, MapFeature[]>();
      for (const f of features) {
        const layer = LAYER_OF(f.properties);
        const list = byLayer.get(layer);
        if (list) list.push(f);
        else byLayer.set(layer, [f]);
      }
      const indexes = new Map(
        [...byLayer]
          .filter(([l]) => CLUSTERED[l])
          .map(([l, fs]) => [l, buildIndex(fs)] as const),
      );

      const place = (
        style: ReturnType<typeof styleFor>,
        coords: [number, number],
        onClick?: () => void,
      ): void => {
        const element = document.createElement(onClick ? "button" : "div");
        element.className = "nw-marker";
        element.title = style.title;
        if (element instanceof HTMLButtonElement) {
          element.type = "button";
          element.setAttribute("aria-label", style.title);
        }

        const shape = document.createElement("span");
        shape.className = style.className;
        if (style.background) shape.style.background = style.background;
        if (style.borderColor) shape.style.borderColor = style.borderColor;
        if (style.color) shape.style.color = style.color;
        if (style.label !== undefined) {
          shape.textContent = style.label;
          const px = style.opacity ?? 28;
          shape.style.width = `${px}px`;
          shape.style.height = `${px}px`;
        } else if (style.opacity !== undefined) {
          shape.style.opacity = String(style.opacity);
        }
        element.appendChild(shape);
        if (onClick) element.addEventListener("click", onClick);

        markers.current.push(
          new maplibre.Marker({ element }).setLngLat(coords).addTo(instance),
        );
      };

      const render = (): void => {
        for (const m of markers.current) m.remove();
        markers.current = [];

        const b = instance.getBounds();
        const bbox: [number, number, number, number] = [
          b.getWest(),
          b.getSouth(),
          b.getEast(),
          b.getNorth(),
        ];
        const zoom = instance.getZoom();

        // Draw quiet layers first so alarms and reports sit on top of them.
        const order: Layer[] = ["gauge", "channel", "crowd", "alarm"];

        for (const layer of order) {
          const list = byLayer.get(layer);
          if (!list || list.length === 0) continue;

          // A field of gauges at city scale buries the alarms; the rainfall
          // summary above the map carries that signal until the viewer zooms.
          if (layer === "gauge" && zoom < GAUGE_MIN_ZOOM) continue;

          if (!CLUSTERED[layer]) {
            for (const f of list) {
              const coords = f.geometry.coordinates as [number, number];
              place(styleFor(f.properties, locale), coords, () =>
                select.current?.({
                  props: f.properties,
                  lon: coords[0],
                  lat: coords[1],
                }),
              );
            }
            continue;
          }

          const index = indexes.get(layer);
          if (!index) continue;

          for (const c of index.getClusters(bbox, Math.round(zoom))) {
            const coords = c.geometry.coordinates as [number, number];
            const props = c.properties as AnyProps & {
              cluster?: boolean;
              cluster_id?: number;
            } & Partial<ClusterSummary>;

            if (props.cluster) {
              const summary: ClusterSummary = {
                count: props.count ?? 0,
                maxDepth: props.maxDepth ?? -1,
                hasAlarm: props.hasAlarm ?? false,
              };
              place(clusterStyle(layer, summary), coords, () => {
                instance.easeTo({
                  center: coords,
                  zoom: Math.min(
                    17,
                    index.getClusterExpansionZoom(props.cluster_id ?? 0),
                  ),
                });
              });
              continue;
            }

            place(styleFor(props, locale), coords, () =>
              select.current?.({
                props: props as AnyProps,
                lon: coords[0],
                lat: coords[1],
              }),
            );
          }
        }
      };

      render();
      instance.on("moveend", render);
      instance.on("zoomend", render);
      detach = () => {
        instance.off("moveend", render);
        instance.off("zoomend", render);
      };
    })();

    return () => {
      cancelled = true;
      detach?.();
    };
  }, [features, locale, scheme]);

  // Centre on the viewer when they ask to be located, and mark where they are.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !focus) return;

    instance.easeTo({
      center: [focus.lon, focus.lat],
      zoom: Math.max(instance.getZoom(), 14),
    });

    let marker: Marker | undefined;
    void (async () => {
      const maplibre = await import("maplibre-gl");
      if (!map.current) return;
      const el = document.createElement("div");
      el.className = "nw-marker";
      const dot = document.createElement("span");
      dot.className = "nw-here";
      el.appendChild(dot);
      marker = new maplibre.Marker({ element: el })
        .setLngLat([focus.lon, focus.lat])
        .addTo(instance);
    })();

    return () => {
      marker?.remove();
    };
  }, [focus]);

  return (
    // `absolute inset-0` rather than `size-full`: the parent is a flex item with
    // only a min-height, so a percentage height resolves to 0 and the map renders
    // into a zero-height box while still happily fetching tiles.
    <div className="absolute inset-0">
      <div
        ref={container}
        className="size-full"
        aria-label={t("title")}
        role="application"
      />
      {/* The List view is the accessible equivalent (Hard rule 22). */}
      <p className="sr-only">{t("loading")}</p>
    </div>
  );
}
