import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as schema from "./schema.ts";

const DIR = "supabase/migrations";
const RLS_MIGRATION = `${DIR}/99990000000000_indexes_rls.sql`;
/** All migration SQL concatenated — generated filenames change, so never name one. */
const allMigrations = (): string =>
  readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(`${DIR}/${f}`, "utf8"))
    .join("\n");

// `schema` also exports the const enums, so widen before narrowing to tables.
const tableNames = (Object.values(schema) as unknown[])
  .filter((v): v is PgTable => is(v, PgTable))
  .map(getTableName)
  .sort();

describe("schema", () => {
  it("declares the tables SPEC §11 requires", () => {
    expect(tableNames).toEqual([
      "dams",
      "external_reports",
      "moderation_log",
      "rate_limits",
      "regions",
      "report_votes",
      "reports",
      "source_health",
      "station_readings",
      "stations",
    ]);
  });

  //. A new table that forgets RLS is a silent security hole, so the
  // migration's table list has to stay in step with the schema.
  //
  // Two places count: the original RLS migration's table list, and an explicit
  // ENABLE in a later migration. The RLS file says new tables must do the
  // latter — editing an applied migration is not allowed — so a guard that
  // only read the one file would force exactly the edit the rules forbid.
  it("enables RLS on every table", () => {
    const sql = readFileSync(RLS_MIGRATION, "utf8");
    const listed = [...sql.matchAll(/'([a-z_]+)'(?=[,\s\]])/g)].map(
      (m) => m[1]!,
    );
    const later = readdirSync(DIR)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(`${DIR}/${f}`, "utf8"))
      .join("\n");
    for (const table of tableNames) {
      const enabled =
        listed.includes(table) ||
        new RegExp(
          `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
          "i",
        ).test(later);
      expect(enabled, `${table} has no RLS in any migration`).toBe(true);
    }
  });

  // GIST on every geom column.
  it("creates a GIST index for every geography/geometry column", () => {
    const sql = allMigrations();
    const geomColumns = [...sql.matchAll(/"(\w+)" geo(?:graphy|metry)\(/g)].map(
      (m) => m[1]!,
    );
    expect(geomColumns.length).toBeGreaterThan(0);
    for (const col of new Set(geomColumns)) {
      expect(sql, `no GIST index covering "${col}"`).toMatch(
        new RegExp(`using gist \\(${col}\\)`),
      );
    }
  });
});
