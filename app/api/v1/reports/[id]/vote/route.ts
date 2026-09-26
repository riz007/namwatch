import { NextResponse } from 'next/server';
import { apiError, CACHE } from '@/lib/api/respond.ts';
import { reportIdSchema, voteSchema } from '@/lib/api/schemas.ts';
import { deviceHash } from '@/lib/api/device.ts';
import { castVote } from '@/lib/db/queries/reports.ts';
import { isDatabaseConfigured } from '@/lib/db/index.ts';
import { log } from '@/lib/log.ts';

/**
 * SPEC §12 `POST /api/v1/reports/:id/vote`. Never cached.
 * SPEC §6.2: one vote per device per report; a vote extends or ends the
 * report's life. No Turnstile here — a vote is cheap and the per-device
 * uniqueness constraint already bounds the damage.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!reportIdSchema.safeParse(id).success) return apiError('not_found');
  if (!isDatabaseConfigured()) return apiError('unavailable');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('invalid_request', { detail: 'expected a JSON body' });
  }

  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) return apiError('invalid_request', { detail: 'vote must be still, receded or flag' });

  let device: string;
  try {
    device = await deviceHash();
  } catch (error) {
    log.error({ err: String(error) }, 'device hashing unavailable');
    return apiError('server_error');
  }

  const outcome = await castVote(id, device, parsed.data.vote);
  if (outcome === 'not_found') return apiError('not_found');

  return NextResponse.json(
    { outcome, vote: parsed.data.vote },
    { status: outcome === 'already_voted' ? 200 : 201, headers: { 'cache-control': CACHE.none } },
  );
}
