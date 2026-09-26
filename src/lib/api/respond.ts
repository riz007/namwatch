import { NextResponse } from 'next/server';

/**
 * Response helpers for the v1 API. SPEC §12.
 *
 * Errors use `{ error: { code, message_th, message_en } }` — bilingual, because
 * the client may be rendering in either locale and an English-only error string
 * is useless to most of our users.
 */
export type ApiErrorCode =
  | 'invalid_request'
  | 'not_found'
  | 'rate_limited'
  | 'turnstile_failed'
  | 'unauthorised'
  | 'server_error'
  | 'unavailable';

type Messages = { th: string; en: string };

const MESSAGES: Record<ApiErrorCode, Messages> = {
  invalid_request: { th: 'ข้อมูลไม่ถูกต้อง', en: 'Invalid request' },
  not_found: { th: 'ไม่พบข้อมูล', en: 'Not found' },
  rate_limited: {
    th: 'ส่งรายงานถี่เกินไป รอสักครู่แล้วลองใหม่',
    en: 'Too many reports too quickly. Wait a moment and try again.',
  },
  turnstile_failed: {
    th: 'ยืนยันตัวตนไม่สำเร็จ ลองใหม่อีกครั้ง',
    en: 'Verification failed. Please try again.',
  },
  unauthorised: { th: 'ไม่ได้รับอนุญาต', en: 'Unauthorised' },
  server_error: { th: 'เกิดข้อผิดพลาดของระบบ', en: 'Something went wrong' },
  unavailable: { th: 'ระบบไม่พร้อมใช้งานชั่วคราว', en: 'Temporarily unavailable' },
};

const STATUS: Record<ApiErrorCode, number> = {
  invalid_request: 400,
  not_found: 404,
  rate_limited: 429,
  turnstile_failed: 403,
  unauthorised: 401,
  server_error: 500,
  unavailable: 503,
};

export function apiError(
  code: ApiErrorCode,
  init?: { detail?: string; headers?: HeadersInit; status?: number },
): NextResponse {
  const m = MESSAGES[code];
  return NextResponse.json(
    {
      error: {
        code,
        message_th: m.th,
        message_en: m.en,
        ...(init?.detail ? { detail: init.detail } : {}),
      },
    },
    {
      status: init?.status ?? STATUS[code],
      headers: { 'cache-control': 'no-store', ...(init?.headers ?? {}) },
    },
  );
}

/** SPEC §12 cache policies, named so a route cannot invent its own. */
export const CACHE = {
  map: 'public, s-maxage=30, stale-while-revalidate=300',
  report: 'public, s-maxage=15, stale-while-revalidate=60',
  station: 'public, s-maxage=120, stale-while-revalidate=600',
  summary: 'public, s-maxage=60, stale-while-revalidate=300',
  photo: 'public, s-maxage=86400, immutable',
  /** Hard rule 9: mutations are never cached. */
  none: 'no-store',
} as const;

export function apiOk(body: unknown, cache: string = CACHE.none): NextResponse {
  return NextResponse.json(body, { headers: { 'cache-control': cache } });
}
