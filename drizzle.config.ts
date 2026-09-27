import { defineConfig } from "drizzle-kit";

/**
 * Migrations are generated into `supabase/migrations/` and applied with
 * `pnpm db:migrate`, which uses DATABASE_URL_DIRECT (port 5432) — the pooler
 * cannot run DDL reliably. Never hand-edit a migration once it has been applied.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./supabase/migrations",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL ?? "",
  },
  migrations: { prefix: "timestamp" },
  verbose: true,
  strict: true,
});
