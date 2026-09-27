import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Guards against the app misrepresenting a crisis.
 *
 * Each of these encodes a bug that was actually shipped, because every one of
 * them is easy to reintroduce with a reasonable-looking change.
 */
const mapQueries = readFileSync("src/lib/db/queries/map.ts", "utf8");
const summary = readFileSync("src/components/flood/SummaryBar.tsx", "utf8");
const vote = readFileSync("app/api/v1/reports/[id]/vote/route.ts", "utf8");

describe("not overstating a crisis", () => {
  it("drops complaints the agency has closed or judged unrelated", () => {
    expect(mapQueries).toMatch(/not in \('finish','irrelevant'\)/);
  });
});

describe("not understating a crisis", () => {
  it("re-checks a station severity against the clock on read, not just on write", () => {
    // A status frozen at ingest keeps asserting "critical" after ingest stalls.
    expect(mapQueries).toMatch(
      /when r\.observed_at < now\(\) - interval '3 hours' then 'unknown'/,
    );
  });

  it("will not corroborate a report with a stale gauge", () => {
    const near = mapQueries.slice(mapQueries.indexOf("floodingStationsNear"));
    expect(near).toMatch(/observed_at >= now\(\) - interval '3 hours'/);
  });
});

describe("not claiming safety it cannot vouch for", () => {
  it("only shows an all-clear when data is both fresh and complete", () => {
    expect(summary).toMatch(
      /const quiet = nothingShowing && !stale && !degraded/,
    );
  });

  it('says "unknown" rather than "quiet" when the feed has stalled', () => {
    expect(summary).toMatch(
      /const unknown = nothingShowing && \(stale \|\| degraded\)/,
    );
    expect(summary).toContain("summary.unknown");
  });
});

describe("not letting one actor rewrite the picture", () => {
  it("rate limits voting, which now decides how long a report lives", () => {
    expect(vote).toMatch(/bumpRateLimit\(`vote:device:/);
    expect(vote).toMatch(/bumpRateLimit\(`vote:ip:/);
    expect(vote).toMatch(/rate_limited/);
  });
});
