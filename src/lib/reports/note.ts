/**
 * Note validation. "Profanity and link filter on notes. No URLs
 * allowed in notes."
 */
import { NOTE_MAX_LENGTH } from "@/config/app.config.ts";

export type NoteRejection = "too_long" | "contains_link" | "contains_profanity";

/**
 * URL-ish patterns, deliberately broad. Spammers write "example dot com" and
 * "hxxp://", so this catches bare domains and obfuscated schemes too. A false
 * positive costs someone a rephrase; a false negative puts a live link in front
 * of people during an emergency.
 */
const LINK_PATTERNS: readonly RegExp[] = [
  /\bh[tx]{2}ps?:\/\//i,
  /\bwww\./i,
  /\/\//,
  // Bare domain with a common TLD, e.g. "spam.co.th"
  /\b[a-z0-9-]+\.(?:com|net|org|co|io|me|ru|cn|th|xyz|top|link|shop|info|biz)\b/i,
  // "example dot com"
  /\b(?:dot|จุด)\s+(?:com|net|org|co|th)\b/i,
  /\bt\.me\/|\bline\.me\/|\bbit\.ly\b/i,
];

/**
 * A deliberately small list of unambiguous Thai and English profanity. This is a
 * spam and abuse tripwire, not a morality filter: a report that trips it is
 * rejected with a message asking for a rephrase, and nothing is silently dropped.
 */
const PROFANITY: readonly string[] = [
  "ควย",
  "เหี้ย",
  "สัส",
  "สัตว์เดรัจฉาน",
  "อีดอก",
  "กระหรี่",
  "แม่ง",
  "ไอ้สัส",
  "fuck",
  "shit",
  "cunt",
  "bitch",
  "asshole",
];

export function validateNote(note: string | null | undefined): {
  ok: boolean;
  reason?: NoteRejection;
} {
  if (note == null) return { ok: true };
  const trimmed = note.trim();
  if (trimmed === "") return { ok: true };

  // Never measure Thai by JS char count for display, but the DB
  // constraint is char_length, so this must match the DB exactly.
  if ([...trimmed].length > NOTE_MAX_LENGTH)
    return { ok: false, reason: "too_long" };

  if (LINK_PATTERNS.some((re) => re.test(trimmed))) {
    return { ok: false, reason: "contains_link" };
  }

  const lowered = trimmed.toLowerCase();
  if (PROFANITY.some((word) => lowered.includes(word))) {
    return { ok: false, reason: "contains_profanity" };
  }

  return { ok: true };
}
