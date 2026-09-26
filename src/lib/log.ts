import pino from 'pino';

/**
 * Structured logging. SPEC §14 observability: logs carry source/adapter tags.
 *
 * Never log a coordinate, a note, a device id or an env value (Hard rules 25-28
 * and the CLAUDE.md guardrail). Log ids and counts instead.
 */
export const log = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: { service: 'namwatch' },
  redact: {
    paths: ['*.deviceHash', '*.ipHash', '*.note', '*.geom', '*.geomExact', 'req.headers.cookie'],
    censor: '[redacted]',
  },
});

export const sourceLog = (source: string) => log.child({ source });
