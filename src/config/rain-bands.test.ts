import { describe, expect, it } from 'vitest';
import { rainBandFor } from './rain-bands.ts';

describe('rain bands', () => {
  it('follows the Thai Meteorological Department 24-hour thresholds', () => {
    expect(rainBandFor(0)).toBe('none');
    expect(rainBandFor(5)).toBe('light');
    expect(rainBandFor(10)).toBe('light');
    expect(rainBandFor(10.1)).toBe('moderate');
    expect(rainBandFor(35)).toBe('moderate');
    expect(rainBandFor(35.1)).toBe('heavy');
    expect(rainBandFor(90)).toBe('heavy');
    expect(rainBandFor(90.1)).toBe('extreme');
    // What Bangkok gauges were actually reading during the flood.
    expect(rainBandFor(166)).toBe('extreme');
  });

  it('returns null rather than guessing when there is no reading', () => {
    expect(rainBandFor(null)).toBeNull();
    expect(rainBandFor(undefined)).toBeNull();
    expect(rainBandFor(Number.NaN)).toBeNull();
  });
});
