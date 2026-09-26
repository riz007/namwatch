import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import th from '../../i18n/messages/th.json' with { type: 'json' };
import en from '../../i18n/messages/en.json' with { type: 'json' };

/**
 * A "need help" report must never read as a rescue request. These assertions
 * exist because that is the one mistake in this app that could get somebody
 * hurt, and it is easy to undo with a well-meaning copy edit.
 */
const form = readFileSync('src/components/report/ReportForm.tsx', 'utf8');
const notice = readFileSync('src/components/report/HelpNotice.tsx', 'utf8');

describe('need-help flow', () => {
  it('shows the hotlines as soon as help is selected, not after submitting', () => {
    expect(form).toMatch(/kind === 'help' && <HelpNotice \/>/);
  });

  it('repeats the hotlines on the confirmation screen', () => {
    expect(form).toMatch(/isHelp && \(/);
  });

  it('takes its numbers from the shared config, never inline', () => {
    expect(notice).toContain("from '@/config/hotlines.ts'");
    expect(notice).not.toMatch(/tel:\d/);
  });

  it('states plainly that nobody is dispatched, in both languages', () => {
    expect(en.report.helpUrgentBody).toMatch(/not a rescue service/i);
    expect(en.report.helpUrgentBody).toMatch(/do not send help/i);
    expect(th.report.helpUrgentBody).toContain('ไม่ใช่หน่วยกู้ภัย');
  });

  it('never tells someone their report reached rescue services', () => {
    for (const copy of [en.report.successHelpBody, en.report.successHelpTitle]) {
      expect(copy).not.toMatch(/help is on the way|rescue.*dispatched|we have sent/i);
    }
    expect(en.report.successHelpBody).toMatch(/does not reach rescue/i);
  });
});
