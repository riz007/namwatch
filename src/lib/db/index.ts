import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

/**
 * The single place a database client is constructed.
 *
 * `server-only` makes this a build error if it is ever imported from a client
 * component, which is the mechanical half of the browser never
 * talks to Supabase.
 *
 * Connects over the Supavisor transaction pooler (port 6543) with
 * `prepare: false`, because that pooler does not support prepared statements.
 */

let client: postgres.Sql | undefined;
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;

export class DatabaseUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new DatabaseUnavailableError(
      "DATABASE_URL is not set. Set it in .env.local (Supabase transaction pooler, port 6543).",
    );
  }
  return url;
}

export function sqlClient(): postgres.Sql {
  client ??= postgres(connectionString(), {
    // Required by the Supavisor transaction pooler.
    prepare: false,
    // Free tier: keep the connection count small.
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
  return client;
}

export function db() {
  database ??= drizzle(sqlClient(), { schema, casing: "snake_case" });
  return database;
}

/** True when the app is configured to reach a database at all. */
export const isDatabaseConfigured = (): boolean =>
  Boolean(process.env.DATABASE_URL);

export { schema };
