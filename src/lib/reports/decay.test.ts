import { describe, expect, it } from 'vitest';
import { decayOpacity, hiddenAfterHours, initialExpiry, isExpired, extendedExpiry } from './decay.ts';

const T0 = new Date('2026-09-26T00:00:00Z');
const at = (hours: number): Date => new Date(T0.getTime() + hours * 3_600_000);

describe('decay (SPEC §6.2)', () => {
  it('holds full opacity for the first hour', () => {
    expect(decayOpacity(T0, 'road', T0)).toBe(1);
    expect(decayOpacity(T0, 'road', at(0.99))).toBe(1);
    expect(decayOpacity(T0, 'road', at(1))).toBe(1);
  });

  it('fades to 40% by six hours', () => {
    expect(decayOpacity(T0, 'road', at(6))).toBeCloseTo(0.4, 5);
    // midway between the 1 h and 6 h anchors
    expect(decayOpacity(T0, 'road', at(3.5))).toBeCloseTo(0.7, 5);
  });

  it('decreases monotonically', () => {
    let previous = 1.1;
    for (let h = 0; h <= 12; h += 0.25) {
      const value = decayOpacity(T0, 'road', at(h));
      expect(value).toBeLessThanOrEqual(previous);
      previous = value;
    }
  });

  it('hides a normal report at twelve hours', () => {
    expect(decayOpacity(T0, 'road', at(11.99))).toBeGreaterThan(0);
    expect(decayOpacity(T0, 'road', at(12))).toBe(0);
  });

  it('keeps a help report visible until twenty-four hours', () => {
    expect(hiddenAfterHours('help')).toBe(24);
    expect(decayOpacity(T0, 'help', at(12))).toBeGreaterThan(0);
    expect(decayOpacity(T0, 'help', at(23.9))).toBeGreaterThan(0);
    expect(decayOpacity(T0, 'help', at(24))).toBe(0);
  });

  it('treats a clock skewed into the future as fresh rather than expired', () => {
    expect(decayOpacity(at(1), 'road', T0)).toBe(1);
  });

  it('expires at the right moment', () => {
    const expiry = initialExpiry('road', T0);
    expect(expiry.toISOString()).toBe(at(12).toISOString());
    expect(isExpired(expiry, at(11.99))).toBe(false);
    expect(isExpired(expiry, at(12))).toBe(true);
  });

  it('restarts the clock when someone confirms the flood is still there', () => {
    expect(extendedExpiry('road', at(5)).toISOString()).toBe(at(17).toISOString());
  });
});
