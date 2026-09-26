import type { Metadata } from 'next';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hotlinesFor } from '@/config/hotlines.ts';
import { BANGKOK_REGION_ID } from '@/config/regions.ts';
import { List, Notice, Page, Section } from '@/components/Prose.tsx';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'help' });
  return { title: t('title') };
}

export default async function HelpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const hotlines = hotlinesFor(BANGKOK_REGION_ID);
  const isThai = (await getLocale()) === 'th';

  return (
    <Page title={t('help.title')}>
      <Section title={t('help.hotlinesTitle')}>
        <ul className="grid gap-2">
          {hotlines.map((h) => (
            <li key={h.number}>
              <a
                href={`tel:${h.number}`}
                data-touch
                data-hotline={h.number}
                className="flex min-h-[var(--size-touch)] items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-3 transition-colors duration-[var(--dur-fast)] hover:border-[var(--color-accent)]"
              >
                <span className="tabular text-[var(--text-2xl)] font-bold text-[var(--color-ink)]">
                  {h.number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-[var(--color-ink)]">
                    {isThai ? h.labelTh : h.labelEn}
                  </span>
                  <span className="block text-[var(--text-xs)] text-[var(--color-muted)]">
                    {isThai ? h.agencyTh : h.agencyEn}
                  </span>
                </span>
                <svg viewBox="0 0 24 24" className="size-5 shrink-0 fill-[var(--color-accent)]" aria-hidden="true">
                  <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1l-2.3 2.2Z" />
                </svg>
              </a>
            </li>
          ))}
        </ul>
      </Section>

      <Notice title={t('help.notRescueTitle')}>
        <p>{t('help.notRescueBody')}</p>
      </Notice>

      <Section title={t('help.safetyTitle')}>
        <List
          items={[
            t('help.safetyElectric'),
            t('help.safetyWade'),
            t('help.safetyDrive'),
            t('help.safetyWater'),
          ]}
        />
      </Section>

      <Section title={t('help.traffyTitle')}>
        <p>{t('help.traffyBody')}</p>
        <a
          href="https://share.traffy.in.th/teamchadchart"
          target="_blank"
          rel="noreferrer noopener"
          data-touch
          className="inline-flex min-h-[var(--size-touch)] items-center gap-2 font-medium text-[var(--color-accent)] underline underline-offset-4"
        >
          {t('report.traffyCta')}
          <svg viewBox="0 0 16 16" className="size-3.5 fill-current" aria-hidden="true">
            <path d="M6 2h8v8h-2V5.4L4.7 12.7 3.3 11.3 10.6 4H6V2Z" />
          </svg>
        </a>
      </Section>

      <Section title={t('help.sheltersTitle')}>
        <p>{t('help.sheltersBody')}</p>
      </Section>
    </Page>
  );
}
