import "server-only";

import { inArray } from "drizzle-orm";
import { db } from "../index.ts";
import { dams } from "../schema.ts";

export type DamRow = typeof dams.$inferSelect;

/** Latest published state for the named dams. */
export async function damsById(ids: readonly string[]): Promise<DamRow[]> {
  if (ids.length === 0) return [];
  return db()
    .select()
    .from(dams)
    .where(inArray(dams.id, [...ids]));
}
