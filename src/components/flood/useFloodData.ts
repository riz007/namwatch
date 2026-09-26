'use client';

import useSWR from 'swr';
import { POLL_MS } from '@/config/app.config.ts';
import type { MapResponse } from '@/lib/api/map-types.ts';

/**
 * The client's only data source. the browser talks to
 * `/api/v1/*` and never to Supabase.
 *
 * Polling is 60 s. `keepPreviousData`
 * means a failed refresh leaves the last-good data on screen rather than
 * blanking the map, which matters on a flaky mobile connection.
 */
async function fetcher(url: string): Promise<MapResponse> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

export function useFloodData(bbox: readonly number[], sinceHours: number) {
  return useSWR<MapResponse>(`/api/v1/map?bbox=${bbox.join(',')}&since=${sinceHours}`, fetcher, {
    refreshInterval: POLL_MS.map,
    keepPreviousData: true,
    revalidateOnFocus: true,
    errorRetryInterval: 15_000,
  });
}
