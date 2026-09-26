'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics.ts';

/**
 * Counts hotline taps without making the emergency bar a client component.
 *
 * The bar must keep working with no JavaScript, so it stays a server component
 * and this listens for the tap instead. Only the dialled number is recorded.
 */
export function HotlineTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-hotline]');
      if (el) track('hotline_tap', { hotline: el.getAttribute('data-hotline') ?? undefined });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return null;
}
