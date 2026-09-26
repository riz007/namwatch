import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing.ts';
import { APP } from '../config/app.config.ts';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    // SPEC §9: all times are Asia/Bangkok.
    timeZone: APP.timeZone,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
