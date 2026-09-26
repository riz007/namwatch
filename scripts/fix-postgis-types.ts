/**
 * Drizzle-kit quotes any column type it does not recognise, so a `geography`
 * column comes out as `"geography(Point,4326)"` — which Postgres reads as an
 * identifier, not a type, and rejects.
 *
 * This runs automatically after `pnpm db:generate` so the fix is reproducible
 * rather than a manual edit someone has to remember.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'supabase/migrations';
const QUOTED_POSTGIS = /"(geography|geometry)\(([^"]*)\)"/g;

let changed = 0;
for (const file of readdirSync(DIR).filter((f) => f.endsWith('.sql'))) {
  const path = join(DIR, file);
  const before = readFileSync(path, 'utf8');
  const after = before.replace(QUOTED_POSTGIS, (_m, type: string, args: string) => `${type}(${args})`);
  if (after !== before) {
    writeFileSync(path, after);
    changed++;
    console.log(`  unquoted PostGIS types in ${file}`);
  }
}
console.log(changed > 0 ? `✓ fixed ${changed} migration(s)` : '✓ no PostGIS type quoting to fix');
