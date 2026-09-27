import { APP } from "@/config/app.config.ts";
import { readFileSync } from "node:fs";
import type { IngestPayload, SourceAdapter } from "../types.ts";
import {
  mergePayloads,
  normalizeRain,
  normalizeWaterLevel,
} from "./normalize.ts";

/**
 * ThaiWater (HII / สสน.) adapter. Contract: the source documentation.
 *
 * Two endpoints are combined: water level (10-minute cohort) and 24-hour
 * rainfall (hourly, 4.5 MB). Rain is fetched on a slower schedule than water
 * level — every poll is a full transfer with no conditional-request support,
 * and asks us not to be wasteful on the free tier.
 */

const BASE = "https://api-v3.thaiwater.net/api/v1/thaiwater30/public";
const WATER_LEVEL_URL = `${BASE}/waterlevel_load`;
const RAIN_URL = `${BASE}/rain_24h`;

/** Rain is hourly; there is no point pulling 4.5 MB more often than this. */
const RAIN_MIN_INTERVAL_MS = 30 * 60_000;

let lastRainFetch = 0;

type RawBundle = { waterLevel: unknown; rain: unknown | null };

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    signal,
    headers: {
      // Identify ourselves to the agency.
      "user-agent": APP.userAgent,
      accept: "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `${url} responded ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

export const thaiwaterAdapter: SourceAdapter = {
  id: "thaiwater",
  provenance: "official_sensor",
  /** Fastest cohort publishes every 10 minutes (docs §7). */
  cadenceMinutes: 10,
  attribution: {
    nameTh: "สถาบันสารสนเทศทรัพยากรน้ำ (องค์การมหาชน)",
    nameEn: "Hydro-Informatics Institute (Public Organization), HII",
    url: "https://www.thaiwater.net/",
    terms:
      "No published licence or acceptable-use policy for api-v3.thaiwater.net as of 26 Sep 2026. " +
      "Used with attribution and polite polling pending written confirmation from HII.",
  },

  async fetchRaw(signal) {
    const waterLevel = await getJson(WATER_LEVEL_URL, signal);

    let rain: unknown = null;
    if (Date.now() - lastRainFetch > RAIN_MIN_INTERVAL_MS) {
      try {
        rain = await getJson(RAIN_URL, signal);
        lastRainFetch = Date.now();
      } catch {
        // Rain is secondary. Losing it must not cost us the water levels,
        // which are the safety-critical half of this source.
        rain = null;
      }
    }

    return { waterLevel, rain } satisfies RawBundle;
  },

  normalize(raw): IngestPayload {
    const bundle = raw as RawBundle;
    const water = normalizeWaterLevel(bundle.waterLevel);
    if (bundle.rain == null) return water;
    return mergePayloads(water, normalizeRain(bundle.rain));
  },

  loadFixture() {
    const read = (name: string): unknown =>
      JSON.parse(
        readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"),
      );
    return {
      waterLevel: read("waterlevel-bangkok.json"),
      rain: read("rain24h-bangkok.json"),
    } satisfies RawBundle;
  },
};
