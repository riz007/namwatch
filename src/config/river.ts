/**
 * The Chao Phraya, north to south, as the river view draws it.
 *
 * Every entry was matched against the live ThaiWater feed on 29 Sep 2026 by
 * station id, and the order is by latitude. The flow-rated RID gauges ("C.")
 * carry discharge; the rest are level-only and fill the gaps nearer Bangkok.
 *
 * Curated rather than "every gauge on the river": there are twenty, and a
 * diagram of twenty reads as a list. These are the points people in Bangkok
 * already follow in the news, in the order the water reaches them.
 */
export type RiverGauge = {
  /** `wl:<ThaiWater station id>`, as the adapter stores it. */
  readonly externalId: string;
  readonly code: string;
  readonly placeTh: string;
  readonly placeEn: string;
};

export const CHAO_PHRAYA_GAUGES: readonly RiverGauge[] = [
  {
    externalId: "wl:2795",
    code: "C.2",
    placeTh: "นครสวรรค์",
    placeEn: "Nakhon Sawan",
  },
  {
    externalId: "wl:2744",
    code: "C.13",
    placeTh: "ชัยนาท · ท้ายเขื่อนเจ้าพระยา",
    placeEn: "Chai Nat · below the Chao Phraya Dam",
  },
  {
    externalId: "wl:2723",
    code: "C.3",
    placeTh: "สิงห์บุรี",
    placeEn: "Sing Buri",
  },
  {
    externalId: "wl:2626",
    code: "C.7A",
    placeTh: "อ่างทอง",
    placeEn: "Ang Thong",
  },
  {
    externalId: "wl:2609",
    code: "C.35",
    placeTh: "พระนครศรีอยุธยา",
    placeEn: "Ayutthaya",
  },
  {
    externalId: "wl:49",
    code: "CPY012",
    placeTh: "บางปะอิน",
    placeEn: "Bang Pa-in",
  },
  {
    externalId: "wl:26",
    code: "CPY014",
    placeTh: "นนทบุรี · สะพานนวลฉวี",
    placeEn: "Nonthaburi · Nuan Chawee Bridge",
  },
  {
    externalId: "wl:2599",
    code: "C.12",
    placeTh: "กรุงเทพฯ · สามเสน",
    placeEn: "Bangkok · Samsen",
  },
  {
    externalId: "wl:4",
    code: "CPY015",
    placeTh: "กรุงเทพฯ · สะพานกรุงเทพ",
    placeEn: "Bangkok · Krung Thep Bridge",
  },
];

/**
 * The large dams whose releases reach Bangkok, with the river each one feeds.
 *
 * The Mae Klong dams (Srinagarind, Vajiralongkorn) are in the same national
 * feed and often fuller, but they drain west to the gulf, not through Bangkok.
 * Listing them here would imply a threat they do not pose.
 */
export type BasinDam = {
  readonly id: string;
  readonly riverTh: string;
  readonly riverEn: string;
  /** Where its river meets the Chao Phraya, for the one-line explanation. */
  readonly joinsTh: string;
  readonly joinsEn: string;
};

export const CHAO_PHRAYA_DAMS: readonly BasinDam[] = [
  {
    id: "thaiwater-dam:1",
    riverTh: "แม่น้ำปิง",
    riverEn: "Ping River",
    joinsTh: "นครสวรรค์",
    joinsEn: "Nakhon Sawan",
  },
  {
    id: "thaiwater-dam:12",
    riverTh: "แม่น้ำน่าน",
    riverEn: "Nan River",
    joinsTh: "นครสวรรค์",
    joinsEn: "Nakhon Sawan",
  },
  {
    id: "thaiwater-dam:36",
    riverTh: "แม่น้ำแควน้อย",
    riverEn: "Khwae Noi River",
    joinsTh: "นครสวรรค์",
    joinsEn: "Nakhon Sawan",
  },
  {
    id: "thaiwater-dam:11",
    riverTh: "แม่น้ำป่าสัก",
    riverEn: "Pa Sak River",
    joinsTh: "พระนครศรีอยุธยา",
    joinsEn: "Ayutthaya",
  },
];
