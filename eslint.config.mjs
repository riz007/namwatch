import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescriptConfig from 'eslint-config-next/typescript';

/** eslint-config-next 16 ships native flat config; no FlatCompat needed. */
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      'supabase/migrations/**',
    ],
  },
  ...coreWebVitals,
  ...typescriptConfig,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Hard rule 6: a client component must never reach the database directly.
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@supabase/*', 'postgres', 'drizzle-orm', 'drizzle-orm/*', '@/lib/db', '@/lib/db/*'],
              message:
                'Hard rule 6: client components must not import a DB client. Go through app/api/* or a server component.',
            },
          ],
        },
      ],
    },
  },
  {
    // Scripts and tests are Node programs, not part of the app bundle.
    files: ['scripts/**/*.ts', '**/*.test.ts', 'e2e/**/*.ts'],
    rules: { 'no-console': 'off', '@typescript-eslint/no-explicit-any': 'off' },
  },
];

export default config;
