import { describe, expect, it } from 'vitest';
import { validateNote } from './note.ts';

describe('note validation (SPEC §6.2)', () => {
  it('accepts an ordinary Thai note', () => {
    expect(validateNote('น้ำท่วมถนนสูงประมาณเข่า รถเล็กผ่านไม่ได้').ok).toBe(true);
  });

  it('accepts empty and missing notes', () => {
    expect(validateNote(null).ok).toBe(true);
    expect(validateNote('   ').ok).toBe(true);
  });

  it('rejects notes over 280 characters, counting Thai correctly', () => {
    // Thai combining marks must not be counted as separate characters here,
    // because the DB constraint is char_length on the same string.
    expect(validateNote('ก'.repeat(280)).ok).toBe(true);
    expect(validateNote('ก'.repeat(281)).reason).toBe('too_long');
  });

  it('rejects links in every shape spammers use', () => {
    for (const note of [
      'ดูที่ http://spam.example',
      'www.spam.co.th',
      'go to spam.com now',
      'hxxps://evil.ru',
      'ที่ line.me/abc',
      'spam dot com',
      'bit.ly/abc',
    ]) {
      expect(validateNote(note).reason, note).toBe('contains_link');
    }
  });

  it('rejects unambiguous profanity in both languages', () => {
    expect(validateNote('ไอ้ควย').reason).toBe('contains_profanity');
    expect(validateNote('what the FUCK').reason).toBe('contains_profanity');
  });

  it('does not reject a normal note that merely mentions a place with a dot', () => {
    expect(validateNote('ซ.ลาดพร้าว 101 น้ำท่วม').ok).toBe(true);
  });
});
