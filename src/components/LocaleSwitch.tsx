'use client';

import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing.ts';

/**
 * SPEC §9: the language switch is always visible and shows "ไทย | EN", never flags.
 *
 * Plain <a> links rather than a router push, so switching language works even if
 * the JS bundle has not finished loading on a slow connection.
 */
const LABELS: Record<Locale, string> = { th: 'ไทย', en: 'EN' };

export function LocaleSwitch() {
  const active = useLocale() as Locale;
  const pathname = usePathname();
  // pathname is "/th/report"; swap just the locale segment.
  const rest = pathname.replace(/^\/(th|en)(?=\/|$)/, '') || '/';

  return (
    <nav aria-label={LABELS[active] === 'ไทย' ? 'ภาษา' : 'Language'} className="flex items-center">
      {routing.locales.map((locale, i) => (
        <span key={locale} className="flex items-center">
          {i > 0 && (
            <span aria-hidden="true" className="px-1 text-[var(--color-text-muted)]">
              |
            </span>
          )}
          <a
            href={`/${locale}${rest === '/' ? '' : rest}`}
            hrefLang={locale}
            lang={locale}
            data-touch
            aria-current={locale === active ? 'true' : undefined}
            className={
              'inline-flex min-h-[var(--size-touch)] items-center px-2 text-sm ' +
              (locale === active
                ? 'font-bold text-[var(--color-text)] underline underline-offset-4'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]')
            }
          >
            {LABELS[locale]}
          </a>
        </span>
      ))}
    </nav>
  );
}
