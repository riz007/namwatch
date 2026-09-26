import { defineRouting } from 'next-intl/routing';

/**
 * `/th/...` and `/en/...`. Thai is the default.
 * First visit falls back to `Accept-Language`; the choice is then stored in a cookie.
 */
export const routing = defineRouting({
  locales: ['th', 'en'],
  defaultLocale: 'th',
  localePrefix: 'always',
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (routing.locales as readonly string[]).includes(value);

/** BCP-47 tags for `lang` attributes and Intl formatters. */
export const HTML_LANG: Record<Locale, string> = { th: 'th-TH', en: 'en-GB' };
