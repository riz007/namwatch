import { z } from 'zod';

/**
 * Upstream payload schemas for `thaiwater`. validate every upstream
 * payload; written against a captured sample, see
 * the source documentation.
 *
 * Note on `.optional()` vs `.nullable()`: the investigation established that
 * HII **omits** keys rather than nulling them — `tele_station_name.en` is absent
 * for 384/805 stations and never null, and `situation_level` is absent for 15
 * and never null. A few fields genuinely are null (`ground_level`,
 * `waterlevel_m`), so those are both. Getting this wrong makes the whole payload
 * fail to parse, which under would silently drop the entire layer.
 */

const bilingual = z.object({
  th: z.string().optional().nullable(),
  en: z.string().optional().nullable(),
  jp: z.string().optional().nullable(),
});

/** Upstream publishes some numerics as strings (`waterlevel_msl`) and some as numbers. */
const loose = z.union([z.number(), z.string()]).optional().nullable();

export const telemetryStationSchema = z.object({
  id: z.number(),
  tele_station_name: bilingual.optional().nullable(),
  tele_station_lat: z.number().optional().nullable(),
  tele_station_long: z.number().optional().nullable(),
  tele_station_oldcode: z.string().optional().nullable(),
  tele_station_type: z.string().optional().nullable(),
  min_bank: loose,
  left_bank: loose,
  right_bank: loose,
  ground_level: loose,
  warning_level_m: loose,
  critical_level_msl: loose,
});

export const geocodeSchema = z
  .object({
    province_name: bilingual.optional().nullable(),
    amphoe_name: bilingual.optional().nullable(),
    tumbon_name: bilingual.optional().nullable(),
    province_code: z.string().optional().nullable(),
  })
  .optional()
  .nullable();

export const agencySchema = z
  .object({
    agency_name: bilingual.optional().nullable(),
    agency_shortname: bilingual.optional().nullable(),
  })
  .optional()
  .nullable();

export const waterLevelReadingSchema = z.object({
  id: z.number().optional().nullable(),
  waterlevel_datetime: z.string(),
  waterlevel_msl: loose,
  waterlevel_m: loose,
  storage_percent: loose,
  /** Unsigned magnitude; the direction lives in `diff_wl_bank_text`. */
  diff_wl_bank: loose,
  diff_wl_bank_text: z.string().optional().nullable(),
  /** Channel-fill band, NOT bank freeboard. Never drives our severity. */
  situation_level: z.number().optional().nullable(),
  station_type: z.string().optional().nullable(),
  station: telemetryStationSchema,
  geocode: geocodeSchema,
  agency: agencySchema,
});

export const waterLevelPayloadSchema = z.object({
  waterlevel_data: z.object({
    data: z.array(waterLevelReadingSchema),
  }),
});

export const rainReadingSchema = z.object({
  id: z.number().optional().nullable(),
  rainfall_datetime: z.string(),
  /** Millimetres. */
  rain_24h: loose,
  rain_1h: loose,
  station: telemetryStationSchema,
  geocode: geocodeSchema,
  agency: agencySchema,
});

export const rainPayloadSchema = z.object({
  data: z.array(rainReadingSchema),
});

export type WaterLevelReading = z.infer<typeof waterLevelReadingSchema>;
export type RainReading = z.infer<typeof rainReadingSchema>;
