import { z } from 'zod';

/**
 * Upstream payload schema for `traffy`. Contract: `docs/sources/traffy.md`.
 *
 * Unlike ThaiWater, Traffy always emits every key and expresses absence as an
 * explicit `null` (verified across 2,259 features), so these are `.nullable()`
 * rather than `.optional()`. They are also marked optional defensively — a
 * schema that is too strict would fail the whole payload and, under Hard rule 5,
 * silently drop the entire layer.
 */

const nullableString = z.string().nullable().optional();

export const aiSchema = z
  .object({
    summary: nullableString,
    categories: z
      .array(z.object({ category: z.string(), confidence: z.number().nullable().optional() }))
      .nullable()
      .optional(),
  })
  .nullable()
  .optional();

export const traffyPropertiesSchema = z.object({
  ticket_id: z.string(),
  message_id: z.number().nullable().optional(),
  problem_type_fondue: z.array(z.string()).nullable().optional(),
  description: nullableString,
  ai: aiSchema,
  state: nullableString,
  state_type_latest: nullableString,
  district: nullableString,
  subdistrict: nullableString,
  province: nullableString,
  address: nullableString,
  photo_url: nullableString,
  timestamp: z.string(),
  last_activity: nullableString,
  org: z.array(z.string()).nullable().optional(),
});

export const traffyFeatureSchema = z.object({
  type: z.literal('Feature').optional(),
  geometry: z
    .object({
      type: z.literal('Point').optional(),
      /** GeoJSON order: [lon, lat]. Verified against Bangkok bounds. */
      coordinates: z.tuple([z.number(), z.number()]),
    })
    .nullable(),
  properties: traffyPropertiesSchema,
});

export const traffyPayloadSchema = z.object({
  features: z.array(traffyFeatureSchema),
  total: z.number().nullable().optional(),
  count: z.number().nullable().optional(),
});

export type TraffyFeature = z.infer<typeof traffyFeatureSchema>;
