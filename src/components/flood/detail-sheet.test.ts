import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "../../i18n/messages/en.json" with { type: "json" };
import th from "../../i18n/messages/th.json" with { type: "json" };

/**
 * The detail sheet is what a responder reads before deciding where to go, so
 * two things about it have to stay true: the coordinates must never be more
 * precise than the privacy rule allows, and the sheet must never imply the app
 * sends anyone.
 */
const sheet = readFileSync("src/components/flood/DetailSheet.tsx", "utf8");
const query = readFileSync("src/lib/db/queries/map.ts", "utf8");

describe("detail sheet", () => {
  it("treats home and help positions as approximate", () => {
    expect(sheet).toMatch(
      /approximate\s*=\s*isReport\(p\) && \(p\.kind === ["']home["'] \|\| p\.kind === ["']help["']\)/,
    );
  });

  it("always states the precision, never only on the blurred case", () => {
    // A branch that renders the caveat only when blurred leaves the exact case
    // unlabelled, and an unlabelled five-decimal number reads as metre-precise.
    expect(sheet).toMatch(/approximate \? t\("approximate"\) : t\("exact"\)/);
  });

  it("says in both languages that a blurred point is an area, not an address", () => {
    expect(en.detail.approximate).toMatch(/approximate/i);
    expect(en.detail.approximate).toMatch(/170\s*m/);
    expect(en.detail.approximate).toMatch(/not the exact spot/i);
    expect(th.detail.approximate).toContain("โดยประมาณ");
    expect(th.detail.approximate).toContain("170");
  });

  it("never claims anyone is dispatched", () => {
    for (const copy of [
      en.detail.respondersNote,
      en.detail.title,
      en.detail.confirmPrompt,
    ]) {
      expect(copy).not.toMatch(
        /help is on the way|rescue.*dispatched|we will send|on their way/i,
      );
    }
    expect(en.detail.respondersNote).toMatch(/do not dispatch/i);
    expect(th.detail.respondersNote).toContain("ไม่ได้ส่งหน่วยช่วยเหลือ");
  });

  it("takes responder hotlines from the shared config, never inline", () => {
    expect(sheet).toMatch(/from ["']@\/config\/hotlines\.ts["']/);
    expect(sheet).not.toMatch(/tel:\d/);
  });

  it("copies the coordinates without falling silent when the clipboard is blocked", () => {
    // The LINE and Facebook in-app browsers deny the async clipboard often
    // enough that a silent failure would be the common case, not the edge one.
    expect(sheet).toMatch(/navigator\.clipboard\.writeText/);
    expect(sheet).toMatch(/document\.execCommand\("copy"\)/);
    expect(sheet).toMatch(/setState\("manual"\)/);
    expect(en.detail.copyManual).toMatch(/press and hold/i);
    expect(th.detail.copyManual).toContain("กดค้าง");
  });

  it("is fed only by the public geometry", () => {
    // The sheet renders whatever coordinates the feature carries, so the
    // guarantee has to hold upstream, in the only place SQL lives. Comments
    // are stripped first, so prose about geom_exact cannot mask a real select
    // of it — or pass for one.
    const sql = query.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(sql).toMatch(/geomPublic/);
    expect(sql).not.toMatch(/geomExact|geom_exact/);
  });
});
