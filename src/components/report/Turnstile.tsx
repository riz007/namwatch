'use client';

import { useEffect, useRef } from 'react';

/**
 * Cloudflare Turnstile, run on submit rather than on page load.
 *
 * Tokens expire after a few minutes, so a token minted when the form opened is
 * often stale by the time someone finishes filling it in — and a form where the
 * verification silently went stale loses the report. The widget is therefore
 * deferred (`execution: 'execute'`) and run when the person presses send.
 *
 * It stays invisible unless Cloudflare actually wants an interaction, which
 * keeps the thirty-second path clear for the overwhelming majority.
 */
type RenderOptions = {
  sitekey: string;
  callback: (token: string) => void;
  'error-callback'?: (code?: string) => void;
  'expired-callback'?: () => void;
  'timeout-callback'?: () => void;
  appearance?: 'always' | 'execute' | 'interaction-only';
  execution?: 'render' | 'execute';
  theme?: 'auto' | 'light' | 'dark';
  action?: string;
};

type TurnstileApi = {
  render: (el: HTMLElement, opts: RenderOptions) => string;
  execute: (id?: string | HTMLElement, opts?: Partial<RenderOptions>) => void;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    onTurnstileLoad?: () => void;
  }
}

const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';

/** How long to wait for a challenge before giving up and telling the person. */
const EXECUTE_TIMEOUT_MS = 20_000;

function loadScript(): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile);
      return;
    }
    const previous = window.onTurnstileLoad;
    window.onTurnstileLoad = () => {
      previous?.();
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('turnstile loaded without an api'));
    };
    if (document.getElementById(SCRIPT_ID)) return;

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('script failed to load'));
    document.head.appendChild(script);
  });
}

export type TurnstileHandle = {
  /** Runs the challenge and resolves with a fresh token, or null on failure. */
  getToken: () => Promise<string | null>;
  reset: () => void;
};

export function Turnstile({
  siteKey,
  onError,
  handleRef,
}: {
  siteKey: string;
  onError: (reason: string) => void;
  handleRef: { current: TurnstileHandle | null };
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const api = useRef<TurnstileApi | null>(null);
  const pending = useRef<((token: string | null) => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    const settle = (token: string | null): void => {
      const resolve = pending.current;
      pending.current = null;
      resolve?.(token);
    };

    void loadScript()
      .then((turnstile) => {
        if (cancelled || !container.current || widgetId.current !== null) return;
        api.current = turnstile;
        widgetId.current = turnstile.render(container.current, {
          sitekey: siteKey,
          action: 'report',
          appearance: 'interaction-only',
          execution: 'execute',
          theme: 'auto',
          callback: (token) => settle(token),
          'error-callback': (code) => {
            onError(code ?? 'error');
            settle(null);
          },
          'expired-callback': () => settle(null),
          'timeout-callback': () => settle(null),
        });

        handleRef.current = {
          getToken: () =>
            new Promise<string | null>((resolve) => {
              if (!api.current || widgetId.current === null) {
                resolve(null);
                return;
              }
              const timer = setTimeout(() => {
                if (pending.current) {
                  pending.current = null;
                  resolve(null);
                }
              }, EXECUTE_TIMEOUT_MS);

              pending.current = (token) => {
                clearTimeout(timer);
                resolve(token);
              };
              // A token is single-use, so always start from a clean widget.
              api.current.reset(widgetId.current);
              api.current.execute(widgetId.current);
            }),
          reset: () => {
            if (api.current && widgetId.current !== null) api.current.reset(widgetId.current);
          },
        };
      })
      .catch((e: unknown) => {
        if (!cancelled) onError(e instanceof Error ? e.message : 'load-failed');
      });

    return () => {
      cancelled = true;
      pending.current = null;
      if (widgetId.current !== null && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
      handleRef.current = null;
    };
    // Re-running this would spawn duplicate widgets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  return <div ref={container} className="flex justify-center empty:hidden" />;
}
