-- Spatial indexes and row-level security.
--
-- Drizzle-kit cannot express GIST indexes or RLS policies, so they live here.
-- Everything is idempotent: this file is applied once by the ledger, but staying
-- idempotent means a partial failure can be safely retried.
--
-- NOTE for future migrations: any NEW table must enable RLS in its own migration.
-- `supabase/migrations.test.ts` fails if a table in the schema is missing here.

-- GIST on every geom column.
create index if not exists stations_geom_gix           on stations           using gist (geom);
create index if not exists reports_geom_public_gix     on reports            using gist (geom_public);
create index if not exists reports_geom_exact_gix      on reports            using gist (geom_exact);
create index if not exists external_reports_geom_gix   on external_reports   using gist (geom);
create index if not exists regions_geom_gix            on regions            using gist (geom);

-- Partial index for the hot path: active, unexpired reports on the map.
create index if not exists reports_active_idx
  on reports (expires_at desc)
  where status = 'active';

-- / RLS is enabled deny-all on every table as defence in
-- depth. The application connects as the owner over a server-side pooled
-- connection and is unaffected; this exists so that a leaked anon/authenticated
-- key can read nothing, even if one is ever introduced by mistake.
--
-- No policies are created. With RLS enabled and zero policies, every non-owner
-- role is denied.
--
-- Deliberately NOT using `force row level security`: that would apply RLS to the
-- table owner too, and the application connects as the owner over the pooler. With
-- zero policies that would deny the app itself. Privileges are revoked from the
-- anon and authenticated roles instead, which is what actually closes the hole a
-- leaked public key would open.
do $$
declare
  t text;
  r text;
begin
  foreach t in array array[
    'regions','stations','station_readings','reports','report_votes',
    'external_reports','source_health','rate_limits','moderation_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    -- Anon/authenticated are Supabase's roles. Guard on existence so the same
    -- migration runs on a plain Postgres.
    foreach r in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke all on public.%I from %I', t, r);
      end if;
    end loop;
  end loop;
end $$;
