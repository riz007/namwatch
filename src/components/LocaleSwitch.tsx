'use client';

import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing.ts';

/**
 * SPEC §9: always visible, shows "ไทย | EN", never flags.
 *
 * Plain anchors rather than a router push, so switching language still works
 * when the JS bundle has not arrived on a weak connection.
 */
const LABELS: Record<Locale, string> = { th: 'ไทย', en: 'EN' };
const NAV_LABEL: Record<Locale, string> = { th: 'ภาษา', en: 'Language' };

export function LocaleSwitch() {
  const active = useLocale() as Locale;
  const pathname = usePathname();
  const rest = pathname.replace(/^\/(th|en)(?=\/|$)/, '') || '';

  return (
    <nav aria-label={NAV_LABEL[active]} className="flex items-center">
      {routing.locales.map((locale, i) => (
        <span key={locale} className="flex items-center">
          {i > 0 && (
            <span aria-hidden="true" className="text-[var(--color-rule)]">
              |
            </span>
          )}
          <a
            href={`/${locale}${rest}`}
            hrefLang={locale}
            lang={locale}
            data-touch
            aria-current={locale === active ? 'true' : undefined}
            className={
              'inline-flex min-h-[var(--size-touch)] items-center px-2 text-[var(--text-sm)] transition-colors duration-[var(--dur-fast)] ' +
              (locale === active
                ? 'font-bold text-[var(--color-ink)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]')
            }
          >
            {LABELS[locale]}
          </a>
        </span>
      ))}
    </nav>
  );
}
