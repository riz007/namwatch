import { z } from "zod";
import { parseBangkokTimestamp } from "../thaiwater/normalize.ts";

/**
 * HII's own warning feed: timestamped Thai sentences, national in scope.
 *
 * National is the problem. A heavy-rain alert for Phatthalung is real and
 * irrelevant to someone deciding whether to drive through Bang Kapi, and a
 * feed that is mostly irrelevant teaches people to stop reading it. So this
 * keeps only warnings that name a province on the Chao Phraya system or around
 * Bangkok — the water that can actually reach them.
 */
const payloadSchema = z.object({
  data: z.array(
    z.object({
      datetime: z.string(),
      message: z.string(),
    }),
  ),
});

/**
 * Provinces whose water reaches Bangkok: the Ping and Nan headwaters and dams,
 * the main stem, the Pa Sak, the Tha Chin distributary, and greater Bangkok.
 */
export const BASIN_PROVINCES = [
  "กรุงเทพ",
  "นนทบุรี",
  "ปทุมธานี",
  "สมุทรปราการ",
  "สมุทรสาคร",
  "นครปฐม",
  "พระนครศรีอยุธยา",
  "อ่างทอง",
  "สิงห์บุรี",
  "ชัยนาท",
  "นครสวรรค์",
  "อุทัยธานี",
  "ลพบุรี",
  "สระบุรี",
  "สุพรรณบุรี",
  "กำแพงเพชร",
  "พิจิตร",
  "พิษณุโลก",
  "ตาก",
  "อุตรดิตถ์",
  "เพชรบูรณ์",
] as const;

export type HiiWarning = {
  /** Stable enough to key a list: the source gives no id. */
  readonly id: string;
  readonly issuedAt: string;
  readonly messageTh: string;
};

export function parseWarnings(raw: unknown): {
  basin: HiiWarning[];
  otherCount: number;
} {
  const { data } = payloadSchema.parse(raw);
  const basin: HiiWarning[] = [];
  let otherCount = 0;

  for (const w of data) {
    const at = parseBangkokTimestamp(w.datetime);
    const message = w.message.replace(/\s+/g, " ").trim();
    if (!at || !message) continue;
    if (!BASIN_PROVINCES.some((p) => message.includes(p))) {
      otherCount += 1;
      continue;
    }
    basin.push({
      id: `${at.toISOString()}|${message.slice(0, 48)}`,
      issuedAt: at.toISOString(),
      messageTh: message,
    });
  }

  basin.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  return { basin, otherCount };
}
