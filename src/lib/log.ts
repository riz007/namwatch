import pino from "pino";

/**
 * Structured logging. observability: logs carry source/adapter tags.
 *
 * Never log a coordinate, a note, a device id or an env value (28
 * and the guardrail). Log ids and counts instead.
 */
export const log = pino({
  level:
    process.env.LOG_LEVEL ??
    (process.env.NODE_ENV === "production" ? "info" : "debug"),
  base: { service: "namwatch" },
  redact: {
    paths: [
      "*.deviceHash",
      "*.ipHash",
      "*.note",
      "*.geom",
      "*.geomExact",
      "req.headers.cookie",
    ],
    censor: "[redacted]",
  },
});

export const sourceLog = (source: string) => log.child({ source });
