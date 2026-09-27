import { config } from "dotenv";
import { existsSync } from "node:fs";

/**
 * Loads environment files the way Next.js does.
 *
 * `dotenv/config` only reads `.env`, so a script importing it would miss
 * `.env.local` entirely and silently fall back to defaults — which for a
 * migration means pointing at the wrong database.
 *
 * First file to define a variable wins, matching Next's precedence.
 */
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) config({ path: file, override: false, quiet: true });
}
