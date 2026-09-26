/**
 * The mark: a gauge post standing in water.
 *
 * It is literally what the app does — watch a water level against a marked
 * post — and it survives being 16 px in a browser tab, which a more
 * illustrative mark would not.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect width="32" height="32" rx="7.5" fill="var(--color-accent, #2C3E8F)" />
      {/* Gauge post with its graduations. */}
      <rect x="14.6" y="5.5" width="2.8" height="16" rx="1.2" fill="#fff" />
      <rect x="10.4" y="8.4" width="3.6" height="1.9" rx="0.95" fill="#fff" opacity="0.9" />
      <rect x="10.4" y="12.6" width="2.4" height="1.9" rx="0.95" fill="#fff" opacity="0.9" />
      <rect x="10.4" y="16.8" width="3.6" height="1.9" rx="0.95" fill="#fff" opacity="0.9" />
      {/* Water, crossing the post. */}
      <path
        d="M1.5 21.4q3.8-2.1 7.6 0t7.6 0t7.6 0t7.6 0v5.1a5.5 5.5 0 0 1-5.5 5.5H7a5.5 5.5 0 0 1-5.5-5.5Z"
        fill="#fff"
        opacity="0.34"
      />
      <path
        d="M1.5 21.4q3.8-2.1 7.6 0t7.6 0t7.6 0t7.6 0"
        stroke="#fff"
        strokeWidth="2.1"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <LogoMark className="inline-block size-[1.15em] align-[-0.18em]" />
    </span>
  );
}
