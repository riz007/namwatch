import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "../../i18n/messages/en.json" with { type: "json" };
import th from "../../i18n/messages/th.json" with { type: "json" };

/**
 * Sensor data and people's reports must not look alike.
 *
 * Asked for by a user during the flood: "when the water actually comes, these
 * two are very different". They were right, and worse than they knew — the
 * alarm style overrode the instrument square with a circle, so an overbank
 * gauge and a crowd report were both filled circles in the same depth colours,
 * differing only in size.
 *
 * Colour cannot carry this: it is spent on severity and may not be reused
 * (depth colours come only from depth-bands.ts). So the encoding is:
 *   ring   — dashed means a person typed it, none means an instrument read it
 *   shape  — which channel carried it
 */
const css = readFileSync("src/styles/globals.css", "utf8");
const markers = readFileSync("src/components/flood/markers.ts", "utf8");
const screen = readFileSync("src/components/flood/FloodScreen.tsx", "utf8");

const rule = (selector: string): string => {
  const at = css.indexOf(selector + " {");
  expect(at, `${selector} missing`).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("}", at));
};

describe("sensor data is distinguishable from what people typed", () => {
  it("rings the things a person typed, and only those", () => {
    expect(rule(".nw-crowd")).toMatch(/outline:\s*2px dashed/);
    expect(rule(".nw-channel")).toMatch(/outline:\s*1\.5px dashed/);
    expect(rule(".nw-sensor")).not.toMatch(/outline:/);
    expect(rule(".nw-alarm")).not.toMatch(/outline:/);
  });

  it("keeps an alarm square, because it is still an instrument reading", () => {
    // border-radius: 50% here is the regression that started this.
    expect(rule(".nw-alarm")).not.toMatch(/border-radius:\s*50%/);
    expect(rule(".nw-crowd")).toMatch(/border-radius:\s*50%/);
  });

  it("rings clustered human reports too, so zooming out cannot launder them", () => {
    expect(rule(".nw-from-people")).toMatch(/outline:\s*2px dashed/);
    expect(rule(".nw-cluster-channel")).toMatch(/outline:\s*2px dashed/);
    expect(markers).toMatch(/nw-cluster-crowd nw-from-people/);
  });

  it("never spends colour on provenance — severity owns the hue", () => {
    // Every background in styleFor comes from a band token, never a source.
    const backgrounds =
      markers.match(/background: `var\(--color-[^`]+`/g) ?? [];
    expect(backgrounds.length).toBeGreaterThan(0);
    for (const b of backgrounds) {
      expect(b).toMatch(
        /\$\{(band|rainBandDef|token)|--color-(depth|rain|paper)/,
      );
    }
  });

  it("lets a reader look at one source alone", () => {
    expect(screen).toMatch(/provenance === "official_sensor"/);
    expect(screen).toMatch(/source === "sensor" \? !measured : measured/);
  });

  it("names both sources in both languages", () => {
    expect(en.source.sensor).toBeTruthy();
    expect(en.source.sensorHint).toMatch(/instrument/i);
    expect(en.source.peopleHint).toMatch(/person/i);
    expect(th.source.sensorHint).toContain("เครื่องมือ");
    expect(th.source.peopleHint).toContain("คนกรอกเอง");
  });
});
