/**
 * Fetches every source from its real upstream and persists the result.
 *
 * This is what the scheduled ingest route does, without the HTTP hop — useful
 * for a first run or for checking a source by hand. `ingest:local` stays
 * fixtures-only so tests and CI never reach the network.
 */
import { REGIONS } from "../src/config/regions.ts";
import { ADAPTERS, runAll } from "../src/lib/sources/registry.ts";
import "./load-env.ts";

if (!process.env.DATABASE_URL) {
  console.error("✗ DATABASE_URL is not set.");
  process.exit(1);
}

const { persistPayload, seedRegions } =
  await import("../src/lib/db/queries/ingest.ts");
const { recordSourceFailure, recordSourceSuccess } =
  await import("../src/lib/db/queries/health.ts");
const { sqlClient } = await import("../src/lib/db/index.ts");

console.log(`Fetching ${ADAPTERS.length} sources from upstream…\n`);

await seedRegions(REGIONS);

const results = await runAll();
let failed = 0;

for (const r of results) {
  if (!r.ok) {
    failed++;
    console.log(`  ✗ ${r.id.padEnd(10)} ${r.error}`);
    await recordSourceFailure(r.id, r.error ?? "unknown", new Date()).catch(
      () => {},
    );
    continue;
  }

  const counts = await persistPayload(r.payload);
  await recordSourceSuccess(r.id, new Date());

  const statuses = new Map<string, number>();
  for (const reading of r.payload.readings) {
    statuses.set(reading.status, (statuses.get(reading.status) ?? 0) + 1);
  }

  console.log(
    `  ✓ ${r.id.padEnd(10)} ${counts.stations} stations, ${counts.readings} readings, ` +
      `${counts.externalReports} external  (${r.durationMs}ms)`,
  );
  if (statuses.size > 0) {
    console.log(
      `               ${[...statuses]
        .sort()
        .map(([k, v]) => `${k}=${v}`)
        .join("  ")}`,
    );
  }
}

await sqlClient().end();
console.log(
  failed === 0 ? "\n✓ all sources ingested" : `\n✗ ${failed} source(s) failed`,
);
process.exit(failed === 0 ? 0 : 1);
