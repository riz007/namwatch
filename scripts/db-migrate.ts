/**
 * Applies every SQL file in `supabase/migrations/` in filename order, once each.
 *
 * Why not `drizzle-kit migrate`: the migration set deliberately mixes generated
 * files with hand-written ones (the PostGIS extension has to run before any table
 * that declares a geography column, and GIST indexes and RLS cannot be generated).
 * A plain ledger keeps the whole set portable, which is the point of
 * moving to any other Postgres should be a connection-string swap.
 *
 * Uses DATABASE_URL_DIRECT (port 5432): the transaction pooler cannot run DDL.
 *
 * Guardrail (): refuses a non-local target unless CONFIRM_MIGRATE names
 * that host, so a stray `pnpm db:migrate` can never touch production.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import 'dotenv/config';

const DIR = 'supabase/migrations';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'db.localhost']);

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  console.error('✗ Set DATABASE_URL_DIRECT (port 5432) in .env.local before migrating.');
  process.exit(1);
}

const host = new URL(url).hostname;
const isLocal = LOCAL_HOSTS.has(host);
if (!isLocal && process.env.CONFIRM_MIGRATE !== host) {
  console.error(
    `✗ Refusing to migrate a non-local database.\n` +
      `  Target host: ${host}\n` +
      `  If this is a development or branch database, re-run with:\n` +
      `      CONFIRM_MIGRATE=${host} pnpm db:migrate\n` +
      `  Never point this at production without being asked to.`,
  );
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

try {
  await sql`
    create table if not exists _migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  const applied = new Set(
    (await sql<{ name: string }[]>`select name from _migrations`).map((r) => r.name),
  );
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const body = readFileSync(join(DIR, file), 'utf8');
    process.stdout.write(`  applying ${file} … `);
    // Each file is one transaction: a failure leaves nothing half-applied.
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into _migrations (name) values (${file})`;
    });
    console.log('ok');
    count++;
  }

  console.log(
    count === 0
      ? `✓ ${host} is up to date (${files.length} migrations already applied)`
      : `✓ applied ${count} migration(s) to ${host}`,
  );
} catch (error) {
  console.error('✗ migration failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
