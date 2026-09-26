/**
 * Runs every adapter once against its committed fixtures. No network.
 *
 * With DATABASE_URL set it also persists, which exercises the real ingest path
 * end to end; without one it just reports what each adapter produced.
 *
 * Pnpm ingest:local
 * DATABASE_URL=postgresql://... pnpm ingest:local
 */
import 'dotenv/config';
import { ADAPTERS, runAll } from '../src/lib/sources/registry.ts';
import { REGIONS } from '../src/config/regions.ts';

const persist = Boolean(process.env.DATABASE_URL);

console.log(`Running ${ADAPTERS.length} adapters against fixtures${persist ? ' and persisting' : ''}…\n`);

const results = await runAll(ADAPTERS, { useFixture: true });

let failures = 0;
for (const r of results) {
  if (!r.ok) {
    failures++;
    console.log(`  ✗ ${r.id.padEnd(10)} ${r.error}`);
    continue;
  }
  const { stations, readings, externalReports } = r.payload;
  console.log(
    `  ✓ ${r.id.padEnd(10)} ${String(stations.length).padStart(4)} stations  ` +
      `${String(readings.length).padStart(4)} readings  ` +
      `${String(externalReports.length).padStart(4)} external  (${r.durationMs}ms)`,
  );

  const statuses = new Map<string, number>();
  for (const reading of readings) statuses.set(reading.status, (statuses.get(reading.status) ?? 0) + 1);
  if (statuses.size > 0) {
    const summary = [...statuses].sort().map(([k, v]) => `${k}=${v}`).join(' ');
    console.log(`               status: ${summary}`);
  }
}

if (persist) {
  const { persistPayload, seedRegions } = await import('../src/lib/db/queries/ingest.ts');
  const { sqlClient } = await import('../src/lib/db/index.ts');

  console.log(`\nSeeding ${REGIONS.length} regions…`);
  await seedRegions(REGIONS);

  for (const r of results) {
    if (!r.ok) continue;
    const counts = await persistPayload(r.payload);
    console.log(
      `  ↳ ${r.id.padEnd(10)} wrote ${counts.stations} stations, ${counts.readings} readings, ${counts.externalReports} external`,
    );
  }
  await sqlClient().end();
}

console.log(failures === 0 ? '\n✓ all adapters ok' : `\n✗ ${failures} adapter(s) failed`);
process.exit(failures === 0 ? 0 : 1);
