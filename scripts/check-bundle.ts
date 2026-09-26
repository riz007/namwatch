/**
 * Enforces the initial-JS budget.
 * "initial JS < 170 KB gz excluding the lazy-loaded map chunk".
 *
 * Measures what the prerendered document actually references, which is the
 * number a phone on 4G pays — not the sum of every chunk in.next.
 *
 * Run after `pnpm build`.
 */
import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync } from 'node:fs';

const BUDGET_KB = 170;
const DOC = '.next/server/app/th.html';

if (!existsSync(DOC)) {
  console.error(`✗ ${DOC} not found — run \`pnpm build\` first.`);
  process.exit(1);
}

const html = readFileSync(DOC, 'utf8');
const scripts = [...new Set(html.match(/\/_next\/static\/[^"']+\.js/g) ?? [])];

let total = 0;
const rows: { kb: number; name: string }[] = [];

for (const src of scripts) {
  const path = `.next${src.slice('/_next'.length)}`;
  if (!existsSync(path)) continue;
  const kb = gzipSync(readFileSync(path)).length / 1024;
  total += kb;
  rows.push({ kb, name: src.split('/').pop() ?? src });
}

rows.sort((a, b) => b.kb - a.kb);
for (const r of rows.slice(0, 8)) {
  console.log(`  ${r.kb.toFixed(1).padStart(7)} KB  ${r.name}`);
}
console.log(`  ${'-'.repeat(34)}`);
console.log(`  ${total.toFixed(1).padStart(7)} KB  initial JS (gzipped)`);

// The map chunk must stay lazy; if it ever lands in the entry the budget is moot.
const mapInEntry = rows.some((r) => /maplibre/i.test(r.name));
if (mapInEntry) {
  console.error('\n✗ maplibre-gl is in the initial bundle — it must stay behind next/dynamic.');
  process.exit(1);
}

if (total > BUDGET_KB) {
  console.error(
    `\n✗ over the ${BUDGET_KB} KB budget by ${(total - BUDGET_KB).toFixed(1)} KB (Hard rule 24).`,
  );
  process.exit(1);
}
console.log(`\n✓ within the ${BUDGET_KB} KB budget, and the map chunk is lazy`);
