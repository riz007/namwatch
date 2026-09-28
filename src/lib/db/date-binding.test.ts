import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Never interpolate a Date into a raw `sql` template.
 *
 * A typed operator (`lt`, `lte`, `gte`) maps the value through the column type
 * and the driver receives a timestamp string. A raw template has no column to
 * map through, so postgres.js is handed a Date object it cannot serialise and
 * the query throws — every time, in every environment.
 *
 * This is not hypothetical: it is why the nightly retention job failed from the
 * day it was written. The failure was invisible because every affected query
 * lived in a job nobody watched, behind an auth error that masked it.
 */
const DIR = "src/lib/db/queries";

/** Parameters that carry a Date in this codebase. */
const DATE_PARAMS =
  /\$\{\s*(now|olderThan|since|at|votedAt|createdAt|expiresAt|observedAt|start|bucket|sevenDaysAgo)\s*\}/;

describe("date binding in SQL", () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".ts"));

  it("has query files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} passes no Date into a raw sql template`, () => {
      const source = readFileSync(`${DIR}/${file}`, "utf8");
      // Every sql`...` template in the file, backticks included.
      const templates = source.match(/sql`[^`]*`/gs) ?? [];
      const offenders = templates.filter((t) => DATE_PARAMS.test(t));
      expect(offenders).toEqual([]);
    });
  }
});
