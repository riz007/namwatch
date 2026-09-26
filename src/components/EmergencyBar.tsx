import { getLocale, getTranslations } from 'next-intl/server';
import { hotlinesFor } from '@/config/hotlines.ts';
import { BANGKOK_REGION_ID } from '@/config/regions.ts';

/**
 * Persistent emergency hotline bar..
 *
 * On every public page, in both languages, numbers only from
 * `src/config/hotlines.ts`.
 * Never implies we dispatch rescue — the copy points at hotlines.
 *
 * Built on <details> deliberately: it expands and collapses with no JavaScript,
 * so it still works on a cheap phone whose bundle has not arrived.
 *
 * Deliberately ink-dark rather than red: red is spec-owned by depth-5
 * ("life-threatening"), and a permanently-red strip at the top of every page
 * would both compete with the severity scale and contradict 's
 * "calm, not alarmist". This reads as an official notice strip.
 */
export async function EmergencyBar({ regionId = BANGKOK_REGION_ID }: { regionId?: string }) {
  const t = await getTranslations('emergency');
  const locale = await getLocale();
  const hotlines = hotlinesFor(regionId);

  return (
    <details className="group border-b border-[var(--color-alert-rule)] bg-[var(--color-alert)] text-[var(--color-alert-ink)]">
      <summary className="flex min-h-[var(--size-touch)] cursor-pointer list-none items-center gap-2 px-4 [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 24 24" className="size-4 shrink-0 fill-current" aria-hidden="true">
          <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1l-2.3 2.2Z" />
        </svg>
        <span className="shrink-0 whitespace-nowrap text-[var(--text-sm)] font-semibold">
          {t('title')}
        </span>

        {/* The four numbers are readable without expanding — on a phone in the
            rain, one fewer tap matters more than a tidy bar. */}
        <span className="tabular ml-auto flex items-center gap-2 overflow-hidden text-[var(--text-sm)] whitespace-nowrap opacity-90 group-open:hidden">
          {hotlines.map((h) => (
            <span key={h.number}>{h.number}</span>
          ))}
        </span>
        <span className="ml-auto hidden text-[var(--text-xs)] opacity-80 group-open:inline">
          {t('collapse')}
        </span>
        <svg
          viewBox="0 0 12 12"
          className="size-3 shrink-0 fill-current opacity-70 transition-transform duration-[var(--dur-fast)] group-open:rotate-180"
          aria-hidden="true"
        >
          <path d="M1.5 4 6 8.5 10.5 4Z" />
        </svg>
      </summary>

      <div className="px-4 pb-3">
        {/* Hard rule 3. */}
        <p className="pb-2 text-[var(--text-xs)] leading-relaxed opacity-85">{t('notice')}</p>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {hotlines.map((h) => (
            <li key={h.number}>
              <a
                href={`tel:${h.number}`}
                data-touch
                data-hotline={h.number}
                className="flex min-h-[var(--size-touch)] items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-alert-rule)] px-3 transition-colors duration-[var(--dur-fast)] hover:bg-white/10"
              >
                <span className="tabular text-[var(--text-xl)] font-semibold">{h.number}</span>
                <span className="text-[var(--text-sm)] opacity-90">
                  {locale === 'th' ? h.labelTh : h.labelEn}
                </span>
                <svg viewBox="0 0 24 24" className="ml-auto size-4 shrink-0 fill-current opacity-60" aria-hidden="true">
                  <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1l-2.3 2.2Z" />
                </svg>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
