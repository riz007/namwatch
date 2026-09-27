import "server-only";

import {
  recordSourceFailure,
  recordSourceSuccess,
} from "../db/queries/health.ts";
import { persistPayload } from "../db/queries/ingest.ts";
import { log } from "../log.ts";
import { ADAPTERS, adapterById, runAdapter } from "./registry.ts";
import type { SourceId } from "./types.ts";

/**
 * One ingest pass: run the due adapters, persist what came back, record health.
 *
 * Kept apart from the route so the same pass can be driven two ways — the cron
 * calling `/api/internal/ingest`, and the map route reviving a stalled feed
 * without a round trip through HTTP and a second cold start.
 */
export type IngestResult = {
  readonly source: string;
  readonly ok: boolean;
  readonly error: string | null;
  readonly counts: Awaited<ReturnType<typeof persistPayload>> | null;
};

export class UnknownSourceError extends Error {
  constructor(readonly source: string) {
    super(`unknown source: ${source}`);
  }
}

export async function runIngest(
  requested?: SourceId | null,
): Promise<{ ok: boolean; results: IngestResult[] }> {
  const adapters = requested
    ? [adapterById(requested)].filter((a) => a !== undefined)
    : [...ADAPTERS];

  if (adapters.length === 0) throw new UnknownSourceError(requested ?? "");

  const results = await Promise.all(
    adapters.map(async (adapter): Promise<IngestResult> => {
      const result = await runAdapter(adapter);
      const at = new Date();

      if (!result.ok) {
        await recordSourceFailure(
          adapter.id,
          result.error ?? "unknown error",
          at,
        ).catch((e) =>
          log.error(
            { source: adapter.id, err: String(e) },
            "could not record source failure",
          ),
        );
        return {
          source: adapter.id,
          ok: false,
          error: result.error,
          counts: null,
        };
      }

      try {
        const counts = await persistPayload(result.payload);
        await recordSourceSuccess(adapter.id, at);
        return { source: adapter.id, ok: true, error: null, counts };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await recordSourceFailure(adapter.id, message, at).catch(() => {});
        log.error({ source: adapter.id, err: message }, "persist failed");
        return { source: adapter.id, ok: false, error: message, counts: null };
      }
    }),
  );

  return { ok: results.every((r) => r.ok), results };
}
