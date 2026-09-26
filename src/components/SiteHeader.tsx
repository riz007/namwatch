import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation.ts';
import { LocaleSwitch } from './LocaleSwitch.tsx';
import { LogoMark } from './Logo.tsx';

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
        {/* The one place the accent appears at full strength, so it reads as
            identity rather than as data. */}
        <LogoMark className="size-6 shrink-0 rounded-[5px]" />
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
