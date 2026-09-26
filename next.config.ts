import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Hard rule 24: keep the client bundle small. The map chunk is lazy-loaded via
  // next/dynamic, which is what actually keeps maplibre-gl out of the entry
  // bundle. Do NOT add maplibre-gl to optimizePackageImports — rewriting its
  // imports breaks the web worker it spawns for tile parsing.
  // Hard rule 6: the browser never talks to Supabase. Nothing here should
  // ever expose a DB or service credential to the client bundle.
  env: {},
};

export default withNextIntl(nextConfig);
