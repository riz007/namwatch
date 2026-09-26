'use client';

/**
 * Analytics, behind consent.
 *
 * Nothing is sent until someone accepts, and what is sent is deliberately
 * coarse: never a coordinate, a note, a photo key or a device identifier. A
 * district name is acceptable; anything that could locate a person is not.
 */
export const CONSENT_KEY = 'nw_consent';

export type Consent = 'granted' | 'denied' | null;

/** Events worth counting. Keeping the list closed stops ad-hoc payloads. */
export type AnalyticsEvent =
  | 'report_started'
  | 'report_submitted'
  | 'report_failed'
  | 'vote_cast'
  | 'share_line'
  | 'hotline_tap'
  | 'locale_switch'
  | 'layer_toggle'
  | 'view_toggle'
  | 'locate_me'
  | 'legend_open';

/** Only these keys may accompany an event, and none of them identifies anyone. */
type SafeParams = {
  depth_band?: number;
  report_kind?: string;
  district?: string;
  vote?: string;
  view?: string;
  hours?: number;
  locale?: string;
  hotline?: string;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function readConsent(): Consent {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    // Private mode, or storage blocked. Treat as undecided and ask again.
    return null;
  }
}

export function writeConsent(value: Exclude<Consent, null>): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Not being able to remember the choice is survivable; sending data
    // without it is not, so the in-memory state still governs this session.
  }
}

export function track(event: AnalyticsEvent, params: SafeParams = {}): void {
  if (typeof window === 'undefined') return;
  if (readConsent() !== 'granted') return;
  window.gtag?.('event', event, params);
}

/**
 * Consent as an external store.
 *
 * Reading localStorage during render would break hydration, and reading it in
 * an effect means a synchronous setState. `useSyncExternalStore` is the shape
 * React provides for exactly this: a server snapshot of "undecided", a client
 * snapshot from storage, and a subscription for later changes.
 */
const listeners = new Set<() => void>();
const CHANGED = 'nw:consent';

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent): void => {
    if (e.key === CONSENT_KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGED, onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGED, onChange);
  };
}

export function setConsent(value: Exclude<Consent, null>): void {
  writeConsent(value);
  window.dispatchEvent(new Event(CHANGED));
  for (const l of listeners) l();
}

export const consentStore = {
  subscribe,
  getSnapshot: (): Consent => readConsent(),
  getServerSnapshot: (): Consent => null,
};
