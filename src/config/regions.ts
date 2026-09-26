/**
 * Region registry. SPEC §8 (multi-city from day one) and §11 (`regions` table).
 *
 * The data model is multi-city: other provinces are added here by configuration,
 * not code (SPEC header, Scope). Only regions with `enabled: true` are served.
 *
 * Boundary geometry is deliberately absent. The licence for Bangkok district
 * polygons is SPEC §18 open question 3; until that is settled we match districts
 * by name (upstream feeds give us Thai district names) rather than shipping
 * geometry of uncertain provenance.
 */

export type RegionLevel = 'province' | 'district' | 'subdistrict';

export type Region = {
  /** Stable id, e.g. 'th-10' or 'th-10-khlong-sam-wa'. Matches `regions.id`. */
  readonly id: string;
  readonly level: RegionLevel;
  readonly parentId: string | null;
  readonly nameTh: string;
  readonly nameEn: string;
  readonly slug: string;
  readonly enabled: boolean;
};

const BKK = 'th-10';

/**
 * The 50 districts (เขต) of Bangkok. Thai names cross-checked against the
 * district values returned by the Traffy Fondue public feed.
 */
const BANGKOK_DISTRICTS: ReadonlyArray<readonly [th: string, en: string, slug: string]> = [
  ['พระนคร', 'Phra Nakhon', 'phra-nakhon'],
  ['ดุสิต', 'Dusit', 'dusit'],
  ['หนองจอก', 'Nong Chok', 'nong-chok'],
  ['บางรัก', 'Bang Rak', 'bang-rak'],
  ['บางเขน', 'Bang Khen', 'bang-khen'],
  ['บางกะปิ', 'Bang Kapi', 'bang-kapi'],
  ['ปทุมวัน', 'Pathum Wan', 'pathum-wan'],
  ['ป้อมปราบศัตรูพ่าย', 'Pom Prap Sattru Phai', 'pom-prap-sattru-phai'],
  ['พระโขนง', 'Phra Khanong', 'phra-khanong'],
  ['มีนบุรี', 'Min Buri', 'min-buri'],
  ['ลาดกระบัง', 'Lat Krabang', 'lat-krabang'],
  ['ยานนาวา', 'Yan Nawa', 'yan-nawa'],
  ['สัมพันธวงศ์', 'Samphanthawong', 'samphanthawong'],
  ['พญาไท', 'Phaya Thai', 'phaya-thai'],
  ['ธนบุรี', 'Thon Buri', 'thon-buri'],
  ['บางกอกใหญ่', 'Bangkok Yai', 'bangkok-yai'],
  ['ห้วยขวาง', 'Huai Khwang', 'huai-khwang'],
  ['คลองสาน', 'Khlong San', 'khlong-san'],
  ['ตลิ่งชัน', 'Taling Chan', 'taling-chan'],
  ['บางกอกน้อย', 'Bangkok Noi', 'bangkok-noi'],
  ['บางขุนเทียน', 'Bang Khun Thian', 'bang-khun-thian'],
  ['ภาษีเจริญ', 'Phasi Charoen', 'phasi-charoen'],
  ['หนองแขม', 'Nong Khaem', 'nong-khaem'],
  ['ราษฎร์บูรณะ', 'Rat Burana', 'rat-burana'],
  ['บางพลัด', 'Bang Phlat', 'bang-phlat'],
  ['ดินแดง', 'Din Daeng', 'din-daeng'],
  ['บึงกุ่ม', 'Bueng Kum', 'bueng-kum'],
  ['สาทร', 'Sathon', 'sathon'],
  ['บางซื่อ', 'Bang Sue', 'bang-sue'],
  ['จตุจักร', 'Chatuchak', 'chatuchak'],
  ['บางคอแหลม', 'Bang Kho Laem', 'bang-kho-laem'],
  ['ประเวศ', 'Prawet', 'prawet'],
  ['คลองเตย', 'Khlong Toei', 'khlong-toei'],
  ['สวนหลวง', 'Suan Luang', 'suan-luang'],
  ['จอมทอง', 'Chom Thong', 'chom-thong'],
  ['ดอนเมือง', 'Don Mueang', 'don-mueang'],
  ['ราชเทวี', 'Ratchathewi', 'ratchathewi'],
  ['ลาดพร้าว', 'Lat Phrao', 'lat-phrao'],
  ['วัฒนา', 'Watthana', 'watthana'],
  ['บางแค', 'Bang Khae', 'bang-khae'],
  ['หลักสี่', 'Lak Si', 'lak-si'],
  ['สายไหม', 'Sai Mai', 'sai-mai'],
  ['คันนายาว', 'Khan Na Yao', 'khan-na-yao'],
  ['สะพานสูง', 'Saphan Sung', 'saphan-sung'],
  ['วังทองหลาง', 'Wang Thonglang', 'wang-thonglang'],
  ['คลองสามวา', 'Khlong Sam Wa', 'khlong-sam-wa'],
  ['บางนา', 'Bang Na', 'bang-na'],
  ['ทวีวัฒนา', 'Thawi Watthana', 'thawi-watthana'],
  ['ทุ่งครุ', 'Thung Khru', 'thung-khru'],
  ['บางบอน', 'Bang Bon', 'bang-bon'],
] as const;

export const REGIONS: readonly Region[] = [
  {
    id: BKK,
    level: 'province',
    parentId: null,
    nameTh: 'กรุงเทพมหานคร',
    nameEn: 'Bangkok',
    slug: 'bangkok',
    enabled: true,
  },
  ...BANGKOK_DISTRICTS.map(
    ([nameTh, nameEn, slug]): Region => ({
      id: `${BKK}-${slug}`,
      level: 'district',
      parentId: BKK,
      nameTh,
      nameEn,
      slug,
      enabled: true,
    }),
  ),
];

export const BANGKOK_REGION_ID = BKK;

const BY_SLUG = new Map(REGIONS.map((r) => [r.slug, r]));
const BY_ID = new Map(REGIONS.map((r) => [r.id, r]));
/** Upstream feeds identify districts by their Thai name, so index that too. */
const BY_THAI_NAME = new Map(
  REGIONS.filter((r) => r.level === 'district').map((r) => [r.nameTh, r]),
);

export const regionBySlug = (slug: string): Region | undefined => BY_SLUG.get(slug);
export const regionById = (id: string): Region | undefined => BY_ID.get(id);

/**
 * Resolve a district by the Thai name an upstream feed gives us.
 * Tolerates the "เขต" prefix that some feeds include and stray whitespace.
 */
export function regionByThaiDistrict(name: string | null | undefined): Region | undefined {
  if (!name) return undefined;
  const cleaned = name.trim().replace(/^เขต\s*/u, '');
  return BY_THAI_NAME.get(cleaned);
}

export const enabledRegions = (): readonly Region[] => REGIONS.filter((r) => r.enabled);
