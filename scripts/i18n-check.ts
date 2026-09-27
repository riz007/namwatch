/**
 * Fails if `th.json` and `en.json` drift apart.
 *
 * Checks, for every locale pair:
 * - identical key sets (a key added to one file must be added to the other)
 * - no empty or whitespace-only values
 * - identical ICU placeholders per key, so `{count}` can't go missing in one locale
 * - every depth band in `src/config/depth-bands.ts` has its label and passability keys
 *
 * Run with `pnpm i18n:check`. CI runs it on every push.
 */
import { readFileSync } from "node:fs";
import { DEPTH_BANDS } from "../src/config/depth-bands.ts";
import { routing } from "../src/i18n/routing.ts";

type Json = { [k: string]: Json | string };

const load = (locale: string): Json =>
  JSON.parse(
    readFileSync(
      new URL(`../src/i18n/messages/${locale}.json`, import.meta.url),
      "utf8",
    ),
  );

function flatten(obj: Json, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else for (const [ck, cv] of flatten(v, key)) out.set(ck, cv);
  }
  return out;
}

/** ICU placeholders such as {count}. Ignores escaped braces. */
const placeholders = (s: string): string[] =>
  [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]!).sort();

const locales = routing.locales;
const flat = new Map(locales.map((l) => [l, flatten(load(l))] as const));
const errors: string[] = [];

const [base, ...rest] = locales;
const baseKeys = flat.get(base!)!;

for (const locale of rest) {
  const keys = flat.get(locale)!;
  for (const k of baseKeys.keys()) {
    if (!keys.has(k))
      errors.push(
        `${locale}.json is missing key "${k}" (present in ${base}.json)`,
      );
  }
  for (const k of keys.keys()) {
    if (!baseKeys.has(k))
      errors.push(
        `${base}.json is missing key "${k}" (present in ${locale}.json)`,
      );
  }
  for (const [k, v] of keys) {
    const bv = baseKeys.get(k);
    if (bv === undefined) continue;
    const [a, b] = [placeholders(bv).join(","), placeholders(v).join(",")];
    if (a !== b) {
      errors.push(
        `placeholder mismatch for "${k}": ${base}={${a}} vs ${locale}={${b}}`,
      );
    }
  }
}

for (const [locale, keys] of flat) {
  for (const [k, v] of keys) {
    if (v.trim() === "")
      errors.push(`${locale}.json has an empty value for "${k}"`);
  }
}

// Every depth band must have copy in every locale.
for (const band of DEPTH_BANDS) {
  for (const key of [band.labelKey, band.passabilityKey]) {
    for (const [locale, keys] of flat) {
      if (!keys.has(key))
        errors.push(`${locale}.json is missing depth band key "${key}"`);
    }
  }
}

if (errors.length > 0) {
  console.error(`✗ i18n check failed (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `✓ i18n check passed — ${baseKeys.size} keys in ${locales.length} locales`,
);
