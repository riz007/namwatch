import type { Metadata } from 'next';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { ADAPTERS } from '@/lib/sources/registry.ts';
import { List, Page, Section } from '@/components/Prose.tsx';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });
  return { title: t('title') };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const isThai = (await getLocale()) === 'th';

  return (
    <Page title={t('about.title')} lede={t('app.description')}>
      <Section title={t('about.whatTitle')}>
        <p>{t('about.whatBody')}</p>
      </Section>

      <Section title={t('about.notOfficialTitle')}>
        <p>{t('about.notOfficialBody')}</p>
      </Section>

      <Section title={t('about.sourcesTitle')}>
        <ul className="space-y-3">
          {ADAPTERS.map((a) => (
            <li
              key={a.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-3"
            >
              <a
                href={a.attribution.url}
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-[var(--color-ink)] underline underline-offset-4"
              >
                {isThai ? a.attribution.nameTh : a.attribution.nameEn}
              </a>
              <p className="pt-1 text-[var(--text-sm)] text-[var(--color-muted)]">
                {t(
                  a.provenance === 'official_sensor'
                    ? 'provenance.officialSensor'
                    : 'provenance.officialChannel',
                )}
              </p>
            </li>
          ))}
        </ul>
        <p className="text-[var(--text-sm)]">{t('map.attribution')}</p>
      </Section>

      <Section title={t('about.privacyTitle')}>
        <p>{t('about.privacyBody')}</p>
        <List items={[t('about.privacyRetention'), t('about.pdpa')]} />
      </Section>

      <Section title={t('about.contactTitle')}>
        <a
          href="https://github.com/riz007/namwatch"
          target="_blank"
          rel="noreferrer noopener"
          data-touch
          className="inline-flex min-h-[var(--size-touch)] items-center gap-2 font-medium text-[var(--color-accent)] underline underline-offset-4"
        >
          github.com/riz007/namwatch
        </a>
      </Section>
    </Page>
  );
}
