import type { ReactNode } from "react";

/**
 * Root layout. The real <html>/<body> live in app/[locale]/layout.tsx so the
 * `lang` attribute can be set per locale.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
