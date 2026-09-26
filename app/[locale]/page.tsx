import { getTranslations, setRequestLocale } from 'next-intl/server';

/** Placeholder. Replaced by the Map/List screen in Stage 6 (SPEC §8.3 screen 1). */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <div className="px-4 py-6">
      <h1 className="text-xl font-bold">{t('map.title')}</h1>
      <p className="pt-2 text-[var(--color-text-muted)]">{t('app.description')}</p>
    </div>
  );
}
