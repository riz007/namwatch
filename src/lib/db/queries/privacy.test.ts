import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * Hard rule 10 / SPEC §6.3: "Exact coordinates of `home`/`help` reports never
 * leave the server. Public responses use `geom_public`."
 *
 * This is the kind of rule that is easy to break by accident months later — a
 * new query copy-pasted from an old one, a `select *`. These tests read the
 * source so the rule is enforced mechanically rather than by review.
 */
const QUERY_DIR = 'src/lib/db/queries';
const API_DIR = 'app/api';

/** Comments discuss the rule constantly; only real code should be matched. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const readAll = (dir: string): { file: string; body: string }[] => {
  const out: { file: string; body: string }[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const path = `${d}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
        out.push({ file: path, body: stripComments(readFileSync(path, 'utf8')) });
      }
    }
  };
  walk(dir);
  return out;
};

describe('location privacy (Hard rule 10)', () => {
  it('never selects geom_exact in a query that can reach a response', () => {
    for (const { file, body } of readAll(QUERY_DIR)) {
      // The single legitimate use is writing it at insert time.
      const withoutInsert = body.replace(/geomExact:\s*sql`[^`]*`\s*as never,/g, '');
      expect(withoutInsert, `${file} reads geom_exact`).not.toMatch(/geomExact:/);
      expect(withoutInsert, `${file} reads geom_exact`).not.toMatch(/geom_exact/);
    }
  });

  it('never uses select * , which would sweep geom_exact into a response', () => {
    for (const { file, body } of readAll(QUERY_DIR)) {
      expect(body, `${file} uses select *`).not.toMatch(/select\s+\*\s+from\s+(reports|\$\{reports\})/i);
    }
  });

  it('keeps API routes out of the database entirely except through the query layer', () => {
    let checked = 0;
    for (const { file, body } of readAll(API_DIR)) {
      checked++;
      expect(body, `${file} should import queries, not build SQL`).not.toMatch(
        /from 'drizzle-orm\/pg-core'/,
      );
      expect(body, `${file} must not construct a DB client (Hard rule 7)`).not.toMatch(
        /from 'postgres'/,
      );
    }
    expect(checked).toBeGreaterThan(0);
  });
});
