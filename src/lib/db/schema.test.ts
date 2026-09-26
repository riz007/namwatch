import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import * as schema from './schema.ts';
import { getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';

const DIR = 'supabase/migrations';
const RLS_MIGRATION = `${DIR}/99990000000000_indexes_rls.sql`;
/** All migration SQL concatenated — generated filenames change, so never name one. */
const allMigrations = (): string =>
  readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(`${DIR}/${f}`, 'utf8'))
    .join('\n');

const tableNames = Object.values(schema)
  .filter((v): v is PgTable => is(v, PgTable))
  .map(getTableName)
  .sort();

describe('schema', () => {
  it('declares the tables SPEC §11 requires', () => {
    expect(tableNames).toEqual([
      'external_reports',
      'moderation_log',
      'rate_limits',
      'regions',
      'report_votes',
      'reports',
      'source_health',
      'station_readings',
      'stations',
    ]);
  });

  // Hard rule 28. A new table that forgets RLS is a silent security hole, so the
  // migration's table list has to stay in step with the schema.
  it('enables RLS on every table', () => {
    const sql = readFileSync(RLS_MIGRATION, 'utf8');
    const listed = [...sql.matchAll(/'([a-z_]+)'(?=[,\s\]])/g)].map((m) => m[1]!);
    for (const table of tableNames) {
      expect(listed, `${table} is missing from the RLS migration`).toContain(table);
    }
  });

  // SPEC §11: GIST on every geom column.
  it('creates a GIST index for every geography/geometry column', () => {
    const sql = allMigrations();
    const geomColumns = [...sql.matchAll(/"(\w+)" geo(?:graphy|metry)\(/g)].map((m) => m[1]!);
    expect(geomColumns.length).toBeGreaterThan(0);
    for (const col of new Set(geomColumns)) {
      expect(sql, `no GIST index covering "${col}"`).toMatch(
        new RegExp(`using gist \\(${col}\\)`),
      );
    }
  });
});
