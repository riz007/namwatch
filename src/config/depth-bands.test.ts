import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEPTH_BANDS, depthBand, isDepthBand } from './depth-bands.ts';
import { renderDepthTokens } from '../../scripts/generate-tokens.ts';

describe('depth bands', () => {
  it('covers exactly the six bands in SPEC §6.1', () => {
    expect(DEPTH_BANDS.map((b) => b.band)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('has an unbroken, ascending depth range', () => {
    for (let i = 1; i < DEPTH_BANDS.length; i++) {
      const prev = DEPTH_BANDS[i - 1]!;
      const curr = DEPTH_BANDS[i]!;
      expect(curr.approxCm[0]).toBe(prev.approxCm[1]);
    }
    expect(DEPTH_BANDS.at(-1)!.approxCm[1]).toBeNull();
  });

  it('marks the two deepest bands as not passable', () => {
    expect(depthBand(4).passableBy).toEqual(['none']);
    expect(depthBand(5).passableBy).toEqual(['none']);
  });

  // Hard rule 4: the CSS tokens must not drift from the config.
  it('keeps the generated CSS in step with the config', () => {
    const onDisk = readFileSync('src/styles/depth-tokens.css', 'utf8');
    expect(onDisk).toBe(renderDepthTokens());
  });

  it('rejects out-of-range bands', () => {
    expect(isDepthBand(6)).toBe(false);
    expect(isDepthBand(-1)).toBe(false);
    expect(isDepthBand(2.5)).toBe(false);
    expect(isDepthBand('3')).toBe(false);
    expect(() => depthBand(9)).toThrow();
  });
});
