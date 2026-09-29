import { APP } from "@/config/app.config.ts";
import { readFileSync } from "node:fs";
import type { SourceAdapter } from "../types.ts";
import { normalizeDams } from "./normalize.ts";

/**
 * Large-dam storage from ThaiWater's national summary.
 *
 * The only public route to this data we have found is `thailand_main`, a 10 MB
 * aggregate of which the dam section is about 70 KB. It changes once a day, so
 * the adapter runs at most every six hours; pulling it on the ten-minute water
 * level cadence would move 1.4 GB a day to read a few hundred numbers.
 */
const URL_MAIN =
  "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/thailand_main";

export const thaiwaterDamAdapter: SourceAdapter = {
  id: "thaiwater-dam",
  provenance: "official_sensor",
  /** RID publishes one figure per dam per day. */
  cadenceMinutes: 24 * 60,
  minIntervalMinutes: 6 * 60,
  attribution: {
    nameTh: "กรมชลประทาน ผ่านสถาบันสารสนเทศทรัพยากรน้ำ (องค์การมหาชน)",
    nameEn: "Royal Irrigation Department, via HII",
    url: "https://www.thaiwater.net/",
    terms:
      "No published licence for api-v3.thaiwater.net as of 29 Sep 2026. " +
      "Used with attribution and a six-hour polling floor pending written confirmation from HII.",
  },

  async fetchRaw(signal) {
    const response = await fetch(URL_MAIN, {
      signal,
      headers: { "user-agent": APP.userAgent, accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`${URL_MAIN} responded ${response.status}`);
    }
    const body = (await response.json()) as { dam?: unknown };
    // Keep only what we use, so the rest of the 10 MB is released at once.
    return { dam: body.dam };
  },

  normalize: normalizeDams,

  loadFixture() {
    return JSON.parse(
      readFileSync(
        new URL("./fixtures/thailand-main-dam.json", import.meta.url),
        "utf8",
      ),
    );
  },
};
