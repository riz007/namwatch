import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ReportForm } from '@/components/report/ReportForm.tsx';
import { Page } from '@/components/Prose.tsx';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'report' });
  return { title: t('title') };
}

export default async function ReportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('report');

  // Submissions are verified server-side; without a key configured the API
  // rejects everything, so say so up front rather than after a failed attempt.
  const turnstileConfigured = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  return (
    <Page title={t('title')} lede={t('intro')}>
      <ReportForm turnstileConfigured={turnstileConfigured} />
    </Page>
  );
}
