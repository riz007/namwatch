import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "../../i18n/messages/en.json" with { type: "json" };
import th from "../../i18n/messages/th.json" with { type: "json" };

/**
 * The privacy notice states a retention period. That sentence is a promise to
 * the people who reported, and for a while only half of it was true: the copy
 * said "device and IP", the job cleared the IP hash alone and left the device
 * hash on the row forever.
 *
 * These assertions exist so the copy and the job cannot drift apart again.
 */
const maintain = readFileSync("app/api/internal/maintain/route.ts", "utf8");
const queries = readFileSync("src/lib/db/queries/reports.ts", "utf8");
const schema = readFileSync("src/lib/db/schema.ts", "utf8");

describe("retention matches what the privacy notice promises", () => {
  it("clears both identifiers, not just the IP hash", () => {
    const fn = queries.slice(
      queries.indexOf("export async function clearOldIdentifiers"),
    );
    expect(fn).toMatch(/ipHash: null, deviceHash: null/);
  });

  it("can actually null the device hash on a report", () => {
    // A NOT NULL column cannot be cleared, so the promise would be unkeepable.
    // Scoped to `reports`: report_votes keeps NOT NULL, because those rows are
    // deleted outright rather than blanked.
    const start = schema.indexOf("export const reports = pgTable");
    const reportsTable = schema.slice(
      start,
      schema.indexOf("pgTable", start + 40),
    );
    expect(reportsTable).toMatch(/deviceHash: text\("device_hash"\),/);
    expect(reportsTable).not.toMatch(/device_hash"\)\.notNull/);
  });

  it("prunes the votes, which carry a device hash of their own", () => {
    expect(maintain).toMatch(/pruneVotesForExpiredReports\(sevenDaysAgo\)/);
  });

  it("uses the same seven days the notice states, in both languages", () => {
    expect(maintain).toMatch(
      /const sevenDaysAgo = new Date\(now\.getTime\(\) - 7 \* DAY_MS\)/,
    );
    expect(en.about.privacyRetention).toMatch(/\b7 days\b/);
    expect(th.about.privacyRetention).toMatch(/7\s*วัน/);
  });

  it("still says device and IP, so the copy stays the thing being kept to", () => {
    expect(en.about.privacyRetention).toMatch(/device and IP/i);
  });
});
