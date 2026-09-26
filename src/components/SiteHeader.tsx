import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation.ts';
import { LocaleSwitch } from './LocaleSwitch.tsx';

export async function SiteHeader() {
  const t = await getTranslations();

  return (
    <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2">
      <Link href="/" className="flex items-center gap-2 font-bold text-[var(--color-text)]">
        <span className="text-base">{t('app.name')}</span>
      </Link>
      <div className="flex items-center gap-1">
        <Link
          href="/help"
          data-touch
          className="inline-flex min-h-[var(--size-touch)] items-center px-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          {t('nav.help')}
        </Link>
        <LocaleSwitch />
      </div>
    </header>
  );
}
