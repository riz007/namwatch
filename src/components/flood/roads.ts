import { depthBand, isDepthBand } from "@/config/depth-bands.ts";
import { regionById } from "@/config/regions.ts";
import {
  isExternal,
  isReport,
  isStation,
  type MapFeature,
} from "@/lib/api/map-types.ts";

/**
 * Grouping flood reports by the place a person would name.
 *
 * What this deliberately is not: a claim that a road is flooded end to end.
 * No upstream source carries road geometry, and Traffy's address field is
 * subdistrict-level for flood cases — roughly one complaint in three hundred
 * names a road. Drawing a line down Sukhumvit because one point sits on it
 * would invent a closure we have no evidence for.
 *
 * So a group is "what has been reported at this place", nothing more. Where a
 * reporter named the road we use it; otherwise the district is the finest
 * honest granularity we have.
 */
export type RoadGroup = {
  /** Stable key for React and for the detail link. */
  readonly id: string;
  /** Road or soi when someone named one, else the district. */
  readonly name: string;
  /** Present only when `name` is a road, so the row can show where it is. */
  readonly districtName: string | null;
  /** True when a reporter named the road; false when we fell back. */
  readonly named: boolean;
  readonly worstBand: number | null;
  readonly fromPeople: number;
  readonly fromSensors: number;
  /** Most recent observation in the group. */
  readonly newestAt: string;
  /** What reporters actually saw getting through, deduplicated. */
  readonly observedPassable: readonly string[];
  readonly features: readonly MapFeature[];
};

const timeOf = (f: MapFeature): string => {
  const p = f.properties;
  if (isStation(p)) return p.observedAt ?? new Date(0).toISOString();
  if (isExternal(p)) return p.observedAt;
  return p.createdAt;
};

const districtOf = (f: MapFeature, locale: string): string | null => {
  const p = f.properties;
  const region = p.regionId ? regionById(p.regionId) : undefined;
  if (!region) return null;
  return locale === "th" ? `เขต${region.nameTh}` : region.nameEn;
};

/**
 * Vehicles that can still pass, from the worst depth in the group.
 *
 * Taken from the spec-owned band definition rather than averaged from what
 * people typed: the bands already carry this mapping, and a group is only as
 * passable as its worst point.
 */
export const passableForBand = (band: number | null): readonly string[] =>
  band === null || !isDepthBand(band) ? [] : depthBand(band).passableBy;

export function groupByRoad(
  features: readonly MapFeature[],
  locale: string,
): readonly RoadGroup[] {
  const buckets = new Map<string, MapFeature[]>();

  for (const f of features) {
    const p = f.properties;
    // Rain gauges say nothing about whether a road is usable.
    if (isStation(p) && p.kind === "rain") continue;
    // Nor does a gauge sitting well below its bank. Including it would put a
    // district in a list of flooding because an instrument there said normal.
    if (isStation(p) && (p.status === "normal" || p.status === "unknown"))
      continue;

    const road = isReport(p) ? p.roadName?.trim() : null;
    const district = districtOf(f, locale);
    const key = road ? `road:${road}` : district ? `area:${district}` : null;
    // A station with no district and no road cannot be placed by name; it is
    // still on the map, it just cannot join a named group.
    if (!key) continue;

    const list = buckets.get(key);
    if (list) list.push(f);
    else buckets.set(key, [f]);
  }

  const groups: RoadGroup[] = [];
  for (const [key, list] of buckets) {
    const named = key.startsWith("road:");
    const name = key.slice(key.indexOf(":") + 1);

    let worstBand: number | null = null;
    let fromPeople = 0;
    let fromSensors = 0;
    let newestAt = new Date(0).toISOString();
    const passable = new Set<string>();

    for (const f of list) {
      const p = f.properties;
      if (p.provenance === "official_sensor") fromSensors += 1;
      else fromPeople += 1;

      if (isReport(p)) {
        if (worstBand === null || p.depthBand > worstBand)
          worstBand = p.depthBand;
        for (const v of p.passableBy ?? []) passable.add(v);
      }
      const at = timeOf(f);
      if (at > newestAt) newestAt = at;
    }

    groups.push({
      id: key,
      name,
      districtName: named ? (districtOf(list[0]!, locale) ?? null) : null,
      named,
      worstBand,
      fromPeople,
      fromSensors,
      newestAt,
      observedPassable: [...passable],
      features: list,
    });
  }

  // Worst water first, then most recent. Someone scanning this during a flood
  // is looking for where not to go, not for an alphabet.
  return groups.sort(
    (a, b) =>
      (b.worstBand ?? -1) - (a.worstBand ?? -1) ||
      b.newestAt.localeCompare(a.newestAt),
  );
}
