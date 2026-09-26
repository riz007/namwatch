import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Thai } from 'next/font/google';
import { routing, HTML_LANG, type Locale } from '@/i18n/routing.ts';
import { APP, SITE_URL } from '@/config/app.config.ts';
import { EmergencyBar } from '@/components/EmergencyBar.tsx';
import { SiteHeader } from '@/components/SiteHeader.tsx';
import '@/styles/globals.css';

/**
 * a Thai-capable body face paired with a Latin face of similar x-height.
 * IBM Plex Sans Thai and IBM Plex Sans are designed as a pair.
 */
const plexThai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-thai',
  display: 'swap',
});

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
});

/** Tabular figures for water levels, times and counts — they get compared down a column. */
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'app' });
  const title = `${t('name')} · ${t('tagline')}`;

  // Both locales are indexable and point at each other, so a Thai search and an
  // English one each land on the right version.
  const languages = Object.fromEntries(routing.locales.map((l) => [l, `/${l}`]));

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s · ${t('name')}` },
    description: t('description'),
    applicationName: t('name'),
    formatDetection: { telephone: true },
    alternates: { canonical: `/${locale}`, languages: { ...languages, 'x-default': '/th' } },
    keywords:
      locale === 'th'
        ? ['น้ำท่วมกรุงเทพ', 'น้ำท่วม', 'ระดับน้ำ', 'แผนที่น้ำท่วม', 'เฝ้าน้ำ', 'คลอง', 'ฝนตก']
        : ['Bangkok flood', 'flood map', 'water level', 'Thailand flooding', 'canal level', 'rainfall'],
    openGraph: {
      type: 'website',
      siteName: t('name'),
      title,
      description: t('description'),
      url: `/${locale}`,
      locale: locale === 'th' ? 'th_TH' : 'en_GB',
      alternateLocale: locale === 'th' ? ['en_GB'] : ['th_TH'],
    },
    twitter: { card: 'summary_large_image', title, description: t('description') },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
    authors: [{ name: t('name'), url: APP.repoUrl }],
    category: 'news',
  };
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // People zoom to read Thai on cheap phones in the rain. Never block that.
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#121417' },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'nav' });
  const app = await getTranslations({ locale, namespace: 'app' });
  const appName = app('name');
  const appDescription = app('description');

  return (
    <html lang={HTML_LANG[locale as Locale]} className={`${plexSans.variable} ${plexThai.variable} ${plexMono.variable}`}>
      <body>
        <script
          type="application/ld+json"
          // Static, locally-built object — no user input reaches it.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: appName,
              url: `${SITE_URL}/${locale}`,
              description: appDescription,
              applicationCategory: 'UtilitiesApplication',
              operatingSystem: 'Any',
              inLanguage: locale === 'th' ? 'th-TH' : 'en-GB',
              isAccessibleForFree: true,
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'THB' },
              areaServed: { '@type': 'City', name: 'Bangkok', addressCountry: 'TH' },
            }),
          }}
        />
        <NextIntlClientProvider>
          <a href="#main" className="sr-only focus:not-sr-only">
            {t('skipToContent')}
          </a>
          {/* Hard rule 1: the emergency bar is on every public page, both languages. */}
          <EmergencyBar />
          <SiteHeader />
          <main id="main">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
