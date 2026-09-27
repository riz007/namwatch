import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BANGKOK_REGION_ID, districtsOf } from "../../config/regions.ts";
import en from "../../i18n/messages/en.json" with { type: "json" };
import th from "../../i18n/messages/th.json" with { type: "json" };
import { resolveRegionId } from "../../lib/geo/region.ts";

/**
 * A coordinate on its own is hard to act on. The district is how agencies and
 * hotline operators name a place, and with no boundary polygons the person
 * reporting is the only one who can supply it — so the picker has to stay
 * wired all the way to `region_id`.
 */
const form = readFileSync("src/components/report/ReportForm.tsx", "utf8");

describe("district on a report", () => {
  it("offers all fifty Bangkok districts", () => {
    expect(districtsOf(BANGKOK_REGION_ID)).toHaveLength(50);
  });

  it("orders them as a Thai reader expects, not by code point", () => {
    const names = districtsOf(BANGKOK_REGION_ID).map((r) => r.nameTh);
    // Leading-vowel names sort under their consonant: เตย under ค, not last.
    expect(names[0]).toBe("คลองเตย");
    expect(names.at(-1)).toBe("ห้วยขวาง");
  });

  it("sends every offered value in a form the server can resolve", () => {
    for (const r of districtsOf(BANGKOK_REGION_ID)) {
      expect(resolveRegionId(r.nameTh)).toBe(r.id);
    }
  });

  it("submits the district with the report", () => {
    expect(form).toMatch(/districtTh: districtTh \|\| undefined/);
  });

  it("lets someone who does not know leave it unset rather than guess", () => {
    // An empty value resolves to null, so a guess is never recorded as fact.
    expect(form).toMatch(/<option value="">\{t\("report\.districtUnsure"\)\}/);
    expect(resolveRegionId("")).toBeNull();
    expect(en.report.districtUnsure).toMatch(/not sure/i);
    expect(th.report.districtUnsure).toContain("ไม่แน่ใจ");
  });

  it("says why it is asked, in both languages", () => {
    expect(en.report.districtHint).toMatch(/rescue|district office/i);
    expect(th.report.districtHint).toContain("กู้ภัย");
  });
});
