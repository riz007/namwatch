import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseWarnings } from "./parse.ts";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/warning.json", import.meta.url), "utf8"),
) as unknown;

describe("HII warnings", () => {
  const { basin, otherCount } = parseWarnings(fixture);

  it("accounts for every warning, kept or set aside", () => {
    expect(basin.length + otherCount).toBe(16);
  });

  it("keeps only warnings that name a province whose water reaches Bangkok", () => {
    // The sample has heavy rain in Phatthalung and Sukhothai: real, and not
    // Bangkok's. Suphan Buri (Tha Chin) is in the basin list.
    expect(basin.some((w) => w.messageTh.includes("พัทลุง"))).toBe(false);
    expect(basin.some((w) => w.messageTh.includes("สุพรรณบุรี"))).toBe(true);
  });

  it("orders newest first, with Bangkok-time stamps turned into instants", () => {
    const times = basin.map((w) => w.issuedAt);
    expect([...times].sort().reverse()).toEqual(times);
    // 20:00 Bangkok is 13:00 UTC.
    expect(times.every((t) => t.endsWith("Z"))).toBe(true);
  });

  it("rejects a payload of the wrong shape", () => {
    expect(() => parseWarnings({ nope: 1 })).toThrow();
  });
});
