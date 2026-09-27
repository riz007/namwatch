import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { traffyAdapter } from "./adapter.ts";
import {
  displayText,
  isFloodTagged,
  normalizeTraffy,
  parseTraffyTimestamp,
  scrubPii,
} from "./normalize.ts";

/** fixtures only, never the network. Captured 26 Sep 2026. */
const edgeCases = JSON.parse(
  readFileSync("src/lib/sources/traffy/fixtures/edge-cases.json", "utf8"),
);

describe("traffy flood tagging", () => {
  it("matches the two real flood tags exactly", () => {
    expect(isFloodTagged(["น้ำท่วม"])).toBe(true);
    expect(isFloodTagged(["อุทกภัย"])).toBe(true);
    expect(isFloodTagged(["ถนน", "น้ำท่วม"])).toBe(true);
  });

  it("does not treat other water problems as flooding", () => {
    // ประปา is tap water and ภัยแล้ง is drought — the opposite condition.
    expect(isFloodTagged(["ประปา"])).toBe(false);
    expect(isFloodTagged(["ภัยแล้ง"])).toBe(false);
    expect(isFloodTagged(["ท่อระบายน้ำ"])).toBe(false);
    expect(isFloodTagged([])).toBe(false);
    expect(isFloodTagged(null)).toBe(false);
  });
});

describe("traffy timestamps", () => {
  it("parses wall-clock Bangkok time rather than runtime-local", () => {
    expect(parseTraffyTimestamp("2026-09-26 11:16:00")?.toISOString()).toBe(
      "2026-09-26T04:16:00.000Z",
    );
  });

  it("returns null rather than Invalid Date", () => {
    expect(parseTraffyTimestamp(null)).toBeNull();
    expect(parseTraffyTimestamp("")).toBeNull();
    expect(parseTraffyTimestamp("yesterday")).toBeNull();
  });
});

describe("traffy PII scrubbing", () => {
  // Real shapes measured in the upstream sample.
  it("removes Thai mobile numbers in every observed format", () => {
    expect(scrubPii("น้ำท่วม โทร 081-867-9067")).not.toMatch(/\d{3}/);
    expect(scrubPii("ติดต่อ 0624249149")).not.toMatch(/0624249149/);
    expect(scrubPii("call +66 81 867 9067")).not.toMatch(/867/);
  });

  it("removes the house number from the structured intake block", () => {
    const block = "ปัญหา: น้ำท่วม\nบ้านเลขที่: 56/7\nถนน: แฮปปี้แลนด์";
    const scrubbed = scrubPii(block);
    expect(scrubbed).not.toContain("56/7");
    expect(scrubbed).toContain("ถนน");
  });

  it("leaves the useful part of a complaint intact", () => {
    const text = "น้ำท่วมขังสูงระดับเข่า รถเล็กผ่านไม่ได้";
    expect(scrubPii(text)).toBe(text);
  });

  it("does not strip a depth figure, which is the useful content", () => {
    expect(scrubPii("น้ำสูง 30 ซม.")).toContain("30");
  });
});

describe("traffy display text", () => {
  it("prefers the abstracted AI summary over raw citizen text", () => {
    const feature = {
      geometry: { coordinates: [100.6, 13.8] as [number, number] },
      properties: {
        ticket_id: "X",
        timestamp: "2026-09-26 11:16:00",
        ai: { summary: "น้ำท่วมขัง" },
        description: "ปัญหา: น้ำท่วม บ้านเลขที่: 66 โทร 0812345678",
      },
    };
    expect(displayText(feature as never)).toBe("น้ำท่วมขัง");
  });

  it("falls back to a scrubbed description when there is no summary", () => {
    const feature = {
      geometry: { coordinates: [100.6, 13.8] as [number, number] },
      properties: {
        ticket_id: "X",
        timestamp: "2026-09-26 11:16:00",
        ai: null,
        description: "น้ำท่วมหนัก โทร 0812345678",
      },
    };
    const text = displayText(feature as never);
    expect(text).toContain("น้ำท่วมหนัก");
    expect(text).not.toContain("0812345678");
  });
});

describe("traffy normalisation against real fixtures", () => {
  const payload = normalizeTraffy(edgeCases);

  it("produces external reports, never stations or readings", () => {
    expect(payload.stations).toEqual([]);
    expect(payload.readings).toEqual([]);
    expect(payload.externalReports.length).toBeGreaterThan(0);
  });

  // This is neither an official sensor nor our own crowd data.
  it("labels every item official_channel", () => {
    for (const r of payload.externalReports) {
      expect(r.provenance).toBe("official_channel");
      expect(r.source).toBe("traffy");
    }
  });

  it("keys on ticket_id, which is the stable public reference", () => {
    for (const r of payload.externalReports) {
      expect(r.externalId).toMatch(/^\d{4}-[A-Z0-9]{6}$/);
    }
    const ids = payload.externalReports.map((r) => r.externalId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the agency workflow state verbatim", () => {
    const states = new Set(payload.externalReports.map((r) => r.state));
    expect(states.size).toBeGreaterThan(0);
    for (const s of states) if (s !== null) expect(s).toMatch(/[ก-๙]/);
  });

  it("never publishes a phone number in the description", () => {
    for (const r of payload.externalReports) {
      if (!r.description) continue;
      expect(r.description, r.externalId).not.toMatch(/\b0\d{8,9}\b/);
      expect(r.description, r.externalId).not.toMatch(
        /\b0\d{1,2}-\d{3}-\d{4}\b/,
      );
    }
  });

  it("places every report inside Thailand, confirming [lon, lat] order", () => {
    for (const r of payload.externalReports) {
      expect(r.point.lon).toBeGreaterThan(96);
      expect(r.point.lon).toBeLessThan(106);
      expect(r.point.lat).toBeGreaterThan(5);
      expect(r.point.lat).toBeLessThan(21);
    }
  });

  it("links back to the citizen-facing ticket", () => {
    for (const r of payload.externalReports) {
      expect(r.url).toContain("traffy.in.th");
      expect(r.url).toContain(r.externalId);
    }
  });
});

describe("traffy adapter", () => {
  it("declares its provenance and attribution", () => {
    expect(traffyAdapter.provenance).toBe("official_channel");
    expect(traffyAdapter.attribution.nameEn).toContain("NECTEC");
  });

  it("normalises its own fixture end to end", () => {
    const payload = traffyAdapter.normalize(traffyAdapter.loadFixture());
    expect(payload.externalReports.length).toBeGreaterThan(20);
    for (const r of payload.externalReports) {
      expect(r.observedAt.getTime()).toBeLessThan(Date.now());
      expect(r.districtTh === null || r.districtTh.length > 0).toBe(true);
    }
  });

  it("throws on a payload it cannot trust, so the registry can degrade the layer", () => {
    expect(() => traffyAdapter.normalize({ nope: true })).toThrow();
    expect(() => traffyAdapter.normalize(null)).toThrow();
  });

  it("skips a feature with no geometry instead of dropping the whole payload", () => {
    const payload = normalizeTraffy({
      features: [
        {
          geometry: null,
          properties: {
            ticket_id: "2026-AAAAAA",
            timestamp: "2026-09-26 10:00:00",
            problem_type_fondue: ["น้ำท่วม"],
          },
        },
        {
          geometry: { coordinates: [100.6, 13.8] },
          properties: {
            ticket_id: "2026-BBBBBB",
            timestamp: "2026-09-26 10:00:00",
            problem_type_fondue: ["น้ำท่วม"],
          },
        },
      ],
    });
    expect(payload.externalReports).toHaveLength(1);
    expect(payload.externalReports[0]?.externalId).toBe("2026-BBBBBB");
  });
});
