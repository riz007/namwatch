'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Supercluster from 'supercluster';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
// Scoped to this lazy chunk, so it never reaches the initial bundle.
import 'maplibre-gl/dist/maplibre-gl.css';
import { BANGKOK_BBOX } from '@/config/app.config.ts';
import { DEPTH_BANDS } from '@/config/depth-bands.ts';
import { isReport, isStation, type AnyProps, type MapFeature } from '@/lib/api/map-types.ts';

/**
 * MapLibre GL + OpenFreeMap vector tiles (SPEC §8.4 — free, no key).
 *
 * Loaded through next/dynamic by the screen, so neither maplibre-gl nor its CSS
 * touches the initial bundle (Hard rule 24: < 170 KB gz excluding the map chunk).
 *
 * Markers are DOM elements rather than a GL symbol layer: at Bangkok scale there
 * are only a few hundred, and DOM markers inherit the same depth tokens the List
 * uses, so the two views cannot disagree about what a band looks like.
 */
/**
 * SPEC §10 non-negotiable 5: dark mode exists because people check at night
 * during outages, on battery. A bright white basemap would defeat both reasons,
 * so the basemap follows the colour scheme.
 */
const STYLE_URL = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

function prefersDark(): boolean {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark') return true;
  if (attr === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Which depth token expresses a station's status, so both views agree. */
function statusToken(status: string): string | null {
  if (status === 'critical') return 'depth-4';
  if (status === 'warning') return 'depth-2';
  if (status === 'watch') return 'depth-1';
  return null;
}

export function MapCanvas({ features }: { features: readonly MapFeature[] }) {
  const container = useRef<HTMLDivElement | null>(null);
  const [scheme, setScheme] = useState<'light' | 'dark'>('light');
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const locale = useLocale();
  const t = useTranslations('map');

  // Follow the viewer's colour scheme, including live changes.
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = (): void => setScheme(prefersDark() ? 'dark' : 'light');
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  // Create the map. Re-created when the locale or the colour scheme changes,
  // since both are baked into the style.
  useEffect(() => {
    if (!container.current || map.current) return;
    let cancelled = false;

    void (async () => {
      const maplibre = await import('maplibre-gl');
      if (cancelled || !container.current) return;

      // MapLibre 6 spawns its tile-parsing worker from a module URL that
      // Turbopack cannot resolve, so the map renders blank while still fetching
      // tiles. Point it at the copy in /public (kept in step by
      // `pnpm sync:map-worker`). Works identically in production, any bundler.
      maplibre.setWorkerUrl('/maplibre-gl-worker.mjs');

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

      // Zoom sits top-right — SPEC §8.1 reserves the bottom thumb zone for the
      // primary action.
      instance.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');

      instance.on('load', () => {
        // SPEC §8.4: labels follow the UI locale via OSM's own name:th / name:en.
        const field =
          locale === 'th'
            ? ['coalesce', ['get', 'name:th'], ['get', 'name']]
            : ['coalesce', ['get', 'name:en'], ['get', 'name']];
        for (const layer of instance.getStyle().layers ?? []) {
          if (layer.type === 'symbol' && layer.layout && 'text-field' in layer.layout) {
            try {
              instance.setLayoutProperty(layer.id, 'text-field', field as never);
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
      const maplibre = await import('maplibre-gl');
      const instance = map.current;
      if (cancelled || !instance) return;

      /**
       * SPEC §8.4: supercluster on the client below 5k points. A few hundred
       * points at Bangkok scale overlap into an unreadable mass; clustering
       * keeps the map legible and the DOM marker count low on cheap phones.
       */
      const index = new Supercluster<AnyProps>({ radius: 52, maxZoom: 15, minPoints: 3 });
      index.load(
        features.map((f) => ({
          type: 'Feature' as const,
          geometry: f.geometry,
          properties: f.properties,
        })),
      );

      const addPoint = (props: AnyProps, coords: [number, number]): void => {
        const element = document.createElement('div');
        element.className = 'nw-marker';

        // MapLibre writes `transform: translate(...)` on the marker element
        // itself, so the diamond's rotation must live on an inner node or it is
        // silently overwritten on every render.
        const shape = document.createElement('span');
        element.appendChild(shape);

        if (isReport(props)) {
          const band = DEPTH_BANDS[props.depthBand] ?? DEPTH_BANDS[0]!;
          shape.className = 'nw-shape nw-crowd';
          shape.style.background = `var(--color-${band.token})`;
          shape.style.borderColor = `var(--color-${band.token}-border)`;
          shape.style.opacity = String(Math.max(0.4, props.opacity));
        } else if (isStation(props)) {
          const token = statusToken(props.status);
          shape.className = 'nw-shape nw-sensor';
          shape.style.background = token ? `var(--color-${token})` : 'var(--color-paper-2)';
          shape.style.borderColor = token ? `var(--color-${token}-border)` : 'var(--color-ink-2)';
          // An unknown reading must not read as "fine" — it reads as no data.
          if (!token) shape.style.opacity = '0.8';
          element.title = (locale === 'th' ? props.nameTh : props.nameEn) ?? props.id;
        } else {
          shape.className = 'nw-shape nw-channel';
          element.title = props.description ?? props.source;
        }

        markers.current.push(new maplibre.Marker({ element }).setLngLat(coords).addTo(instance));
      };

      const render = (): void => {
        for (const m of markers.current) m.remove();
        markers.current = [];

        const b = instance.getBounds();
        const clusters = index.getClusters(
          [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
          Math.round(instance.getZoom()),
        );

        for (const c of clusters) {
          const coords = c.geometry.coordinates as [number, number];
          const props = c.properties as AnyProps & {
            cluster?: boolean;
            cluster_id?: number;
            point_count?: number;
          };

          if (props.cluster) {
            const count = props.point_count ?? 0;
            const element = document.createElement('div');
            element.className = 'nw-marker';
            const bubble = document.createElement('span');
            bubble.className = 'nw-cluster';
            bubble.textContent = String(count);
            const size = Math.min(42, 22 + Math.log2(Math.max(count, 2)) * 4);
            bubble.style.width = `${size}px`;
            bubble.style.height = `${size}px`;
            element.appendChild(bubble);
            element.addEventListener('click', () => {
              instance.easeTo({
                center: coords,
                zoom: Math.min(17, index.getClusterExpansionZoom(props.cluster_id ?? 0)),
              });
            });
            markers.current.push(
              new maplibre.Marker({ element }).setLngLat(coords).addTo(instance),
            );
            continue;
          }

          addPoint(props, coords);
        }
      };

      render();
      instance.on('moveend', render);
      instance.on('zoomend', render);
      detach = () => {
        instance.off('moveend', render);
        instance.off('zoomend', render);
      };
    })();

    return () => {
      cancelled = true;
      detach?.();
    };
  }, [features, locale, scheme]);

  return (
    // `absolute inset-0` rather than `size-full`: the parent is a flex item with
    // only a min-height, so a percentage height resolves to 0 and the map renders
    // into a zero-height box while still happily fetching tiles.
    <div className="absolute inset-0">
      <div ref={container} className="size-full" aria-label={t('title')} role="application" />
      {/* The List view is the accessible equivalent (Hard rule 22). */}
      <p className="sr-only">{t('loading')}</p>
    </div>
  );
}
