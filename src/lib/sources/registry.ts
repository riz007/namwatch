/**
 * Adapter registry and the safety wrapper around every adapter call.
 *
 * "A failing source adapter must degrade only its own layer. Never
 * throw into page render." That guarantee lives here — `runAdapter` never
 * rejects. Whatever an adapter does (throws, hangs, returns nonsense), the
 * caller gets an `AdapterResult` and the other layers are unaffected.
 */
import { sourceLog } from "../log.ts";
import { thaiwaterAdapter } from "./thaiwater/adapter.ts";
import { traffyAdapter } from "./traffy/adapter.ts";
import {
  emptyPayload,
  type AdapterResult,
  type SourceAdapter,
  type SourceId,
} from "./types.ts";

/** Every adapter wired into ingest.  `bma-dds` and `rainviewer`. */
export const ADAPTERS: readonly SourceAdapter[] = [
  thaiwaterAdapter,
  traffyAdapter,
];

export const adapterById = (id: SourceId): SourceAdapter | undefined =>
  ADAPTERS.find((a) => a.id === id);

/** Upstream is someone else's server on a bad day. Never wait forever. */
const FETCH_TIMEOUT_MS = 25_000;

export type RunOptions = {
  /** Use the committed fixture instead of the network (`pnpm ingest:local`). */
  readonly useFixture?: boolean;
  readonly timeoutMs?: number;
};

export async function runAdapter(
  adapter: SourceAdapter,
  options: RunOptions = {},
): Promise<AdapterResult> {
  const started = Date.now();
  const logger = sourceLog(adapter.id);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? FETCH_TIMEOUT_MS,
  );

  try {
    const raw = options.useFixture
      ? adapter.loadFixture()
      : await adapter.fetchRaw(controller.signal);

    const payload = adapter.normalize(raw);
    const durationMs = Date.now() - started;

    logger.info(
      {
        durationMs,
        stations: payload.stations.length,
        readings: payload.readings.length,
        externalReports: payload.externalReports.length,
        fixture: options.useFixture === true,
      },
      "adapter ok",
    );

    return { id: adapter.id, ok: true, payload, error: null, durationMs };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? `timed out after ${options.timeoutMs ?? FETCH_TIMEOUT_MS}ms`
          : error.message
        : String(error);

    // Deliberately not rethrown: this is the boundary.
    logger.warn(
      { err: message, durationMs: Date.now() - started },
      "adapter failed",
    );

    return {
      id: adapter.id,
      ok: false,
      payload: emptyPayload(),
      error: message,
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Runs every adapter concurrently. One failure never affects the others. */
export async function runAll(
  adapters: readonly SourceAdapter[] = ADAPTERS,
  options: RunOptions = {},
): Promise<readonly AdapterResult[]> {
  return Promise.all(adapters.map((a) => runAdapter(a, options)));
}

/** a source is "delayed" once it is older than 3× its cadence. */
export function isStale(
  adapter: SourceAdapter,
  lastSuccessAt: Date | null,
  now: Date = new Date(),
  multiplier = 3,
): boolean {
  if (!lastSuccessAt) return true;
  return (
    now.getTime() - lastSuccessAt.getTime() >
    adapter.cadenceMinutes * 60_000 * multiplier
  );
}
