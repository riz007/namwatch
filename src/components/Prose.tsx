import type { ReactNode } from 'react';

/** Content-page shell. One column, comfortable measure, generous leading. */
export function Page({ title, lede, children }: { title: string; lede?: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[42rem] px-4 pt-5 pb-16">
      <h1 className="text-[var(--text-3xl)] leading-tight font-bold tracking-tight text-[var(--color-ink)]">
        {title}
      </h1>
      {lede && <p className="pt-2 text-[var(--text-lg)] text-[var(--color-ink-2)]">{lede}</p>}
      <div className="space-y-8 pt-7">{children}</div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-[var(--text-xl)] font-bold text-[var(--color-ink)]">{title}</h2>
      <div className="space-y-2 text-[var(--color-ink-2)]">{children}</div>
    </section>
  );
}

/** A section that must not be skimmed past — used for safety guidance. */
export function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-md)] border-2 border-[var(--color-alert)] bg-[var(--color-paper-2)] p-4">
      <h2 className="flex items-start gap-2 text-[var(--text-lg)] font-bold text-[var(--color-ink)]">
        <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 fill-current" aria-hidden="true">
          <path d="M12 2.2 1.4 20.6h21.2L12 2.2Zm0 5.1 6.6 11.5H5.4L12 7.3Zm-.9 3.3h1.8v4.2h-1.8v-4.2Zm0 5.3h1.8v1.8h-1.8v-1.8Z" />
        </svg>
        {title}
      </h2>
      <div className="space-y-2 pt-2 text-[var(--color-ink-2)]">{children}</div>
    </section>
  );
}

export function List({ items }: { items: readonly string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
