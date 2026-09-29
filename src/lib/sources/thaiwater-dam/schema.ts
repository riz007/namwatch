import { z } from "zod";

/**
 * The `dam` section of `/public/thailand_main`. Only the fields we use are
 * required; everything else passes through so an added upstream field never
 * breaks ingest.
 */
const loose = z.union([z.number(), z.string()]).optional().nullable();

const bilingual = z.object({
  th: z.string(),
  en: z.string().optional().nullable(),
});

export const damRowSchema = z.object({
  dam_date: z.string(),
  dam_storage: loose,
  dam_storage_percent: loose,
  dam_inflow: loose,
  dam_released: loose,
  dam_spilled: loose,
  dam: z.object({
    id: z.number(),
    dam_name: bilingual,
    dam_lat: loose,
    dam_long: loose,
    max_storage: loose,
  }),
});

export const damPayloadSchema = z.object({
  dam: z.object({
    data: z.object({
      data: z.array(damRowSchema),
    }),
  }),
});

export type DamRow = z.infer<typeof damRowSchema>;
