import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * GitHub drops scheduled workflows under load, so the cron alone cannot keep
 * the map current. These assertions guard the backstop — and, just as much,
 * guard against it becoming a second uncapped scheduler.
 */
const map = readFileSync("app/api/v1/map/route.ts", "utf8");
// health.ts is server-only, which vitest cannot import; read the source.
const health = readFileSync("src/lib/db/queries/health.ts", "utf8");

describe("reviving a stalled ingest", () => {
  it("runs after the response, so no one waits for it", () => {
    expect(map).toMatch(/after\(async \(\) => \{/);
    expect(map).toMatch(/from "next\/server"/);
  });

  it("only fires when a source is actually stale", () => {
    expect(map).toMatch(/if \(freshness\.staleSources\.length > 0\) \{/);
  });

  it("claims a slot before ingesting, and gives up if it loses", () => {
    expect(map).toMatch(/if \(!\(await claimIngestSlot\(\)\)\) return;/);
  });

  it("never ingests more often than the cron was meant to", () => {
    const every = /AUTO_INGEST_EVERY_MS = (\d+) \* 60_000/.exec(health)?.[1];
    expect(Number(every)).toBeGreaterThanOrEqual(10);
  });

  it("claims the slot with one atomic upsert, not a read-then-write", () => {
    // A select followed by an insert would let two concurrent requests both
    // decide the slot was free.
    const claim = health.slice(
      health.indexOf("export async function claimIngestSlot"),
    );
    expect(claim).toMatch(/onConflictDoUpdate/);
    expect(claim).toMatch(/count \?\? 0\) === 1/);
    expect(claim).not.toMatch(/\.select\(/);
  });

  it("cannot throw into the response path", () => {
    const block = map.slice(map.indexOf("after(async"));
    expect(block).toMatch(/try \{/);
    expect(block).toMatch(/catch \(error\) \{/);
  });
});
