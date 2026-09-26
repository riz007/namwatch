import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation.ts';
import { LocaleSwitch } from './LocaleSwitch.tsx';

/**
 * N9 · edge-aligned minimal. An app screen's chrome, not a marketing masthead —
 * the emergency bar above already owns the top of the page, and the map below
 * owns the rest.
 */
export async function SiteHeader() {
  const t = await getTranslations();

  return (
    <header className="flex items-center gap-3 border-b border-[var(--color-rule)] bg-[var(--color-paper)] px-4">
      <Link
        href="/"
        className="flex min-h-[var(--size-touch)] items-center gap-2 font-bold text-[var(--color-ink)]"
      >
        {/* Wordmark: the accent drop is the one place the accent appears at full
            strength, so it reads as identity rather than as data. */}
        <svg viewBox="0 0 16 16" className="size-4 shrink-0" aria-hidden="true">
          <path
            d="M8 1.2c2.6 3 4.4 5.3 4.4 7.4A4.4 4.4 0 0 1 8 13a4.4 4.4 0 0 1-4.4-4.4C3.6 6.5 5.4 4.2 8 1.2Z"
            fill="var(--color-accent)"
          />
        </svg>
        <span className="text-[var(--text-lg)] tracking-tight">{t('app.name')}</span>
      </Link>

      <div className="ml-auto flex items-center">
        <Link
          href="/help"
          data-touch
          className="inline-flex min-h-[var(--size-touch)] items-center px-2 text-[var(--text-sm)] text-[var(--color-ink-2)] transition-colors duration-[var(--dur-fast)] hover:text-[var(--color-ink)]"
        >
          {t('nav.help')}
        </Link>
        <span aria-hidden="true" className="mx-1 h-4 w-px bg-[var(--color-rule)]" />
        <LocaleSwitch />
      </div>
    </header>
  );
}
