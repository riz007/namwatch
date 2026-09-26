'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation.ts';
import { consentStore, setConsent } from '@/lib/analytics.ts';

/**
 * Consent gate and analytics loader.
 *
 * The Google tag is not merely configured to deny — it is never fetched at all
 * until someone accepts. That is the difference between "we set a flag" and
 * "no request left the device", and it is what the PDPA notice promises.
 *
 * Consent Mode v2 defaults are still declared, so that if the tag is ever
 * loaded by another route it starts denied rather than granted.
 */
export function Analytics({ gaId }: { gaId: string | null }) {
  const t = useTranslations('consent');
  const consent = useSyncExternalStore(
    consentStore.subscribe,
    consentStore.getSnapshot,
    consentStore.getServerSnapshot,
  );

  const choose = useCallback((value: 'granted' | 'denied') => {
    setConsent(value);
    window.gtag?.('consent', 'update', {
      analytics_storage: value,
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  }, []);

  // Server-rendered as null, so the banner only appears after hydration has
  // read the stored choice — it never flashes for someone who already decided.
  const showBanner = consent === null && gaId !== null;

  // The banner is fixed to the bottom, so without this it sits on top of
  // whatever is there — which on the report page is the emergency hotlines.
  // Nothing may ever be permanently covered by a cookie notice.
  const banner = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = banner.current;
    if (!showBanner || !el) {
      document.body.style.removeProperty('padding-bottom');
      return;
    }
    const apply = (): void => {
      document.body.style.paddingBottom = `${el.offsetHeight}px`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.body.style.removeProperty('padding-bottom');
    };
  }, [showBanner]);

  return (
    <>
      {gaId !== null && consent === 'granted' && (
        <>
          <Script
            id="ga-consent-defaults"
            strategy="afterInteractive"
            // Defaults are declared before the tag configures itself.
            dangerouslySetInnerHTML={{
              __html: `
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
window.gtag=gtag;
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});
gtag('consent','update',{analytics_storage:'granted'});`,
            }}
          />
          <Script
            id="ga-script"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
          />
          <Script
            id="ga-config"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
gtag('js', new Date());
gtag('config', '${gaId}', { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });`,
            }}
          />
        </>
      )}

      {showBanner && (
        <div
          ref={banner}
          role="dialog"
          aria-label={t('title')}
          className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--color-rule)] bg-[var(--color-paper)] p-4 shadow-[0_-4px_20px_rgb(0_0_0/0.14)]"
        >
          <div className="mx-auto flex max-w-[42rem] flex-col gap-3">
            <div>
              <h2 className="font-bold text-[var(--color-ink)]">{t('title')}</h2>
              <p className="pt-1 text-[var(--text-sm)] text-[var(--color-ink-2)]">{t('body')}</p>
              <Link
                href="/about"
                className="inline-block pt-1 text-[var(--text-sm)] text-[var(--color-accent)] underline underline-offset-4"
              >
                {t('learnMore')}
              </Link>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => choose('denied')}
                className="btn btn-secondary press flex-1"
              >
                {t('decline')}
              </button>
              <button
                type="button"
                onClick={() => choose('granted')}
                className="btn btn-primary press flex-1"
              >
                {t('accept')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
