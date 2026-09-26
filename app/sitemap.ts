import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/config/app.config.ts';
import { routing } from '@/i18n/routing.ts';

const PATHS = ['', '/report', '/help', '/about'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return routing.locales.flatMap((locale) =>
    PATHS.map((path) => ({
      url: `${SITE_URL}/${locale}${path}`,
      lastModified: new Date(),
      // The map is the live page; the content pages change rarely.
      changeFrequency: (path === '' ? 'hourly' : 'monthly') as 'hourly' | 'monthly',
      priority: path === '' ? 1 : 0.6,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `${SITE_URL}/${l}${path}`]),
        ),
      },
    })),
  );
}
