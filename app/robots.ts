import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/config/app.config.ts';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Nothing under these is useful to a crawler, and the internal routes
        // should not be probed.
        disallow: ['/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
