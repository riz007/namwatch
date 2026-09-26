import 'server-only';

/**
 * Cloudflare Turnstile verification. anti-abuse.
 *
 * Fails closed: if the secret is missing or Cloudflare is unreachable, a
 * submission is rejected rather than waved through. During an emergency a spam
 * flood on the map is worse than a handful of failed submissions, and the
 * client is told to retry.
 */
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileResult = { ok: boolean; reason?: string };

export async function verifyTurnstile(
  token: string,
  remoteIp?: string | null,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: false, reason: 'turnstile_not_configured' };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);

  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { ok: false, reason: `verify_http_${response.status}` };

    const json = (await response.json()) as { success?: boolean; 'error-codes'?: string[] };
    return json.success === true
      ? { ok: true }
      : { ok: false, reason: json['error-codes']?.join(',') ?? 'rejected' };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? `verify_failed:${error.name}` : 'verify_failed',
    };
  }
}
