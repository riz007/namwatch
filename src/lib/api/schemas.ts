import { z } from 'zod';
import { NOTE_MAX_LENGTH } from '@/config/app.config.ts';
import { REPORT_KINDS, VOTE_KINDS } from '@/config/reports.ts';

/**
 * Every request body, query string and upstream payload is
 * validated with zod. These are the request-side schemas; upstream payload
 * schemas live next to their adapter.
 */

export const localeSchema = z.enum(['th', 'en']);

/** Thailand's rough bounds — a coordinate outside them is a bug or an attack. */
const lonSchema = z.number().min(96).max(106);
const latSchema = z.number().min(5).max(21);

export const mapQuerySchema = z.object({
  bbox: z.string().optional(),
  /** Comma-separated layer ids; absent means all. */
  layers: z.string().optional(),
  /** Hours of history to include. */
  since: z.coerce.number().int().min(1).max(72).default(12),
});

export const reportIdSchema = z.uuid();

export const newReportSchema = z.object({
  kind: z.enum(REPORT_KINDS),
  depthBand: z.coerce.number().int().min(0).max(5),
  lon: lonSchema,
  lat: latSchema,
  note: z
    .string()
    .trim()
    .max(NOTE_MAX_LENGTH)
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
  locale: localeSchema,
  passableBy: z.array(z.enum(['motorbike', 'car', 'pickup', 'none'])).max(4).optional(),
  /** Thai district name, if the client resolved one. */
  districtTh: z.string().max(80).optional(),
  /** Cloudflare Turnstile token. */
  turnstileToken: z.string().min(1).max(4096),
});

export type NewReportInput = z.infer<typeof newReportSchema>;

export const voteSchema = z.object({
  vote: z.enum(VOTE_KINDS),
});

export const stationQuerySchema = z.object({
  hours: z.coerce.number().int().min(1).max(168).default(24),
});

/**
 * Parses a multipart or JSON body into the report shape.
 * POST /api/v1/reports is multipart (fields + optional photo).
 * Photos are, so a file part is accepted and ignored for now.
 */
export async function parseReportBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return request.json();
  }

  const form = await request.formData();
  const raw: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value !== 'string') continue;
    if (key === 'passableBy') {
      (raw['passableBy'] ??= [] as string[]) as string[];
      (raw['passableBy'] as string[]).push(value);
    } else {
      raw[key] = value;
    }
  }
  return raw;
}
