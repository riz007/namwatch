/**
 * Emergency hotline numbers. SPEC §8.2.
 *
 * Hard rule 1: the emergency bar renders on every public page in both languages,
 * and the numbers come ONLY from this file. Reviewed before every release
 * (see the /release-check command).
 *
 * Do not add a number here without confirming it against the operating agency.
 */

export type Hotline = {
  /** Dialled digits. Used for the `tel:` href and shown verbatim. */
  readonly number: string;
  readonly labelTh: string;
  readonly labelEn: string;
  /** Operating agency, shown in About (SPEC §5: attribution in Thai and English). */
  readonly agencyTh: string;
  readonly agencyEn: string;
};

/**
 * Numbers valid nationwide in Thailand. Keyed by region id so a province added
 * later (SPEC §16 Phase 2) can override or extend the list without a code change.
 */
const NATIONAL: readonly Hotline[] = [
  {
    number: '1669',
    labelTh: 'เจ็บป่วยฉุกเฉิน',
    labelEn: 'Medical emergency',
    agencyTh: 'สถาบันการแพทย์ฉุกเฉินแห่งชาติ',
    agencyEn: 'National Institute for Emergency Medicine',
  },
  {
    number: '1784',
    labelTh: 'สายด่วนนิรภัย ปภ.',
    labelEn: 'DDPM disaster hotline',
    agencyTh: 'กรมป้องกันและบรรเทาสาธารณภัย',
    agencyEn: 'Department of Disaster Prevention and Mitigation',
  },
  {
    number: '191',
    labelTh: 'เหตุด่วนเหตุร้าย (ตำรวจ)',
    labelEn: 'Police',
    agencyTh: 'สำนักงานตำรวจแห่งชาติ',
    agencyEn: 'Royal Thai Police',
  },
] as const;

/** Bangkok adds the BMA city hotline. */
const BANGKOK: readonly Hotline[] = [
  ...NATIONAL,
  {
    number: '1555',
    labelTh: 'สายด่วน กทม.',
    labelEn: 'BMA hotline',
    agencyTh: 'กรุงเทพมหานคร',
    agencyEn: 'Bangkok Metropolitan Administration',
  },
] as const;

const BY_REGION: Readonly<Record<string, readonly Hotline[]>> = {
  'th-10': BANGKOK,
};

/**
 * Hotlines for a region, falling back to the nationwide set.
 * Never returns an empty array — Hard rule 1 means the bar always has content.
 */
export function hotlinesFor(regionId: string | null | undefined): readonly Hotline[] {
  if (!regionId) return BANGKOK;
  // 'th-10-khlong-sam-wa' → try the district, then its province 'th-10'.
  const provinceId = regionId.split('-').slice(0, 2).join('-');
  return BY_REGION[regionId] ?? BY_REGION[provinceId] ?? NATIONAL;
}

export const ALL_HOTLINES = { NATIONAL, BANGKOK } as const;
