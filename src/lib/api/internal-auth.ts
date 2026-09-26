import { timingSafeEqual } from 'node:crypto';

/**
 * `/api/internal/*` requires `x-ingest-secret`, compared in
 * constant time so the endpoint cannot be probed a byte at a time.
 */
export function isAuthorisedInternal(request: Request): boolean {
  const expected = process.env.INGEST_SECRET;
  if (!expected) return false;

  const provided = request.headers.get('x-ingest-secret');
  if (!provided) return false;

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  // TimingSafeEqual throws on a length mismatch, which would itself leak the
  // length, so compare a fixed-size digest-like padding instead.
  if (a.length !== b.length) {
    // Still burn a comparison so the timing does not distinguish the two cases.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
