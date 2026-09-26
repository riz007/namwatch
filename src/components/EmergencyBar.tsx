import { getLocale, getTranslations } from 'next-intl/server';
import { hotlinesFor } from '@/config/hotlines.ts';
import { BANGKOK_REGION_ID } from '@/config/regions.ts';

/**
 * Persistent emergency hotline bar. SPEC §8.2.
 *
 * Hard rule 1: renders on every public page, in both languages, and the numbers
 * come only from `src/config/hotlines.ts`.
 * Hard rule 3: this never implies we dispatch rescue — the copy points at hotlines.
 *
 * Built on <details> deliberately: it expands and collapses with no JavaScript, so
 * it still works on a cheap phone with a stalled bundle (SPEC §8.1, §14).
 */
export async function EmergencyBar({ regionId = BANGKOK_REGION_ID }: { regionId?: string }) {
  const t = await getTranslations('emergency');
  const locale = await getLocale();
  const hotlines = hotlinesFor(regionId);

  return (
    <details className="group border-b border-[var(--color-border)] bg-[var(--color-danger)] text-[var(--color-danger-on)]">
      <summary
        className="flex min-h-[var(--size-touch)] cursor-pointer list-none items-center justify-between gap-2 px-4 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden"
        aria-label={t('expand')}
      >
        <span className="flex items-center gap-2">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0 fill-current">
            <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1l-2.3 2.2Z" />
          </svg>
          {t('title')}
        </span>
        <span aria-hidden="true" className="text-xs opacity-80 group-open:hidden">
          {t('expand')}
        </span>
        <span aria-hidden="true" className="hidden text-xs opacity-80 group-open:inline">
          {t('collapse')}
        </span>
      </summary>

      <div className="px-4 pb-3">
        {/* Hard rule 3: never imply we dispatch rescue. */}
        <p className="pb-2 text-xs leading-relaxed opacity-90">{t('notice')}</p>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {hotlines.map((h) => (
            <li key={h.number}>
              <a
                href={`tel:${h.number}`}
                data-touch
                data-hotline={h.number}
                className="flex min-h-[var(--size-touch)] items-center gap-3 rounded-md bg-black/15 px-3 py-2 font-semibold underline-offset-2 hover:bg-black/25 focus-visible:outline-3"
                aria-label={`${t('call', { number: h.number })} — ${locale === 'th' ? h.labelTh : h.labelEn}`}
              >
                <span className="text-lg tabular-nums">{h.number}</span>
                <span className="text-sm font-normal">
                  {locale === 'th' ? h.labelTh : h.labelEn}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
