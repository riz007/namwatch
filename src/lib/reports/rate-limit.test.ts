import { describe, expect, it } from 'vitest';
import { combine, decide, windowStart } from './rate-limit.ts';

const NOW = new Date('2026-09-26T10:07:33.000Z');

describe('rate limiting (SPEC §6.2)', () => {
  it('buckets into fixed ten-minute windows', () => {
    expect(windowStart(NOW).toISOString()).toBe('2026-09-26T10:00:00.000Z');
    expect(windowStart(new Date('2026-09-26T10:10:00.000Z')).toISOString()).toBe(
      '2026-09-26T10:10:00.000Z',
    );
  });

  it('allows five reports and blocks the sixth', () => {
    expect(decide(4, NOW).allowed).toBe(true);
    expect(decide(4, NOW).remaining).toBe(1);
    expect(decide(5, NOW).allowed).toBe(false);
    expect(decide(5, NOW).remaining).toBe(0);
  });

  it('tells a blocked caller when the window reopens', () => {
    expect(decide(5, NOW).retryAfter?.toISOString()).toBe('2026-09-26T10:10:00.000Z');
    expect(decide(1, NOW).retryAfter).toBeNull();
  });

  it('applies the strictest identity when both device and IP are checked', () => {
    const ok = decide(1, NOW);
    const blocked = decide(5, NOW);
    expect(combine([ok, ok]).allowed).toBe(true);
    expect(combine([ok, blocked]).allowed).toBe(false);
    expect(combine([blocked, ok]).allowed).toBe(false);
    expect(combine([ok, ok]).remaining).toBe(4);
  });
});
