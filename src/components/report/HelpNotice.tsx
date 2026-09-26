'use client';

import { useLocale, useTranslations } from 'next-intl';
import { hotlinesFor } from '@/config/hotlines.ts';
import { BANGKOK_REGION_ID } from '@/config/regions.ts';
import { track } from '@/lib/analytics.ts';

/**
 * Shown the moment someone marks a report as needing help.
 *
 * This app does not dispatch anyone. Letting someone in danger fill in a form
 * and read "thanks, it's on the map" would be the most harmful thing it could
 * do, so the hotlines appear here, before the form is finished — not on the
 * confirmation screen afterwards.
 *
 * The numbers come from the shared config, so they can never drift from the
 * emergency bar.
 */
export function HelpNotice() {
  const t = useTranslations('report');
  const locale = useLocale();
  const hotlines = hotlinesFor(BANGKOK_REGION_ID);

  return (
    <aside
      role="alert"
      className="rounded-[var(--radius-md)] border-2 border-[var(--color-alert)] bg-[var(--color-alert)] p-4 text-[var(--color-alert-ink)]"
    >
      <h3 className="flex items-start gap-2 font-bold">
        <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 fill-current" aria-hidden="true">
          <path d="M12 2.2 1.4 20.6h21.2L12 2.2Zm0 5.1 6.6 11.5H5.4L12 7.3Zm-.9 3.3h1.8v4.2h-1.8v-4.2Zm0 5.3h1.8v1.8h-1.8v-1.8Z" />
        </svg>
        {t('helpUrgentTitle')}
      </h3>

      <p className="pt-1.5 text-[var(--text-sm)] leading-relaxed opacity-95">
        {t('helpUrgentBody')}
      </p>

      <ul className="grid gap-2 pt-3">
        {hotlines.map((h) => (
          <li key={h.number}>
            <a
              href={`tel:${h.number}`}
              data-touch
              data-hotline={h.number}
              onClick={() => track('hotline_tap', { hotline: h.number })}
              className="press flex min-h-[var(--size-touch)] items-center gap-3 rounded-[var(--radius-md)] bg-white/12 px-3 hover:bg-white/22"
            >
              <span className="tabular text-[var(--text-xl)] font-bold">{h.number}</span>
              <span className="text-[var(--text-sm)] opacity-95">
                {locale === 'th' ? h.labelTh : h.labelEn}
              </span>
              <svg
                viewBox="0 0 24 24"
                className="ml-auto size-5 shrink-0 fill-current opacity-70"
                aria-hidden="true"
              >
                <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1l-2.3 2.2Z" />
              </svg>
            </a>
          </li>
        ))}
      </ul>

      <p className="pt-3 text-[var(--text-xs)] leading-relaxed opacity-85">
        {t('helpStillSend')}
      </p>
    </aside>
  );
}
