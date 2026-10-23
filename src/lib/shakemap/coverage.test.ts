import { describe, expect, it } from 'vitest';

import { FELT_REPORTS_PALETTE } from '@/lib/felt-reports/palette';

import { getPaletteColor } from './coverage';

describe('getPaletteColor', () => {
  const palette = FELT_REPORTS_PALETTE;

  it('returns the exact palette stop at an integer Intensity', () => {
    expect(getPaletteColor(palette, 2)).toEqual([191 / 255, 204 / 255, 1]);
    expect(getPaletteColor(palette, 9)).toEqual([1, 0, 0]);
  });

  it('interpolates linearly between stops', () => {
    const [red, green, blue] = getPaletteColor(palette, 2.5);
    expect(red).toBeCloseTo((191 + 160) / 2 / 255);
    expect(green).toBeCloseTo((204 + 230) / 2 / 255);
    expect(blue).toBeCloseTo(1);
  });

  it('clamps below and above the extent', () => {
    expect(getPaletteColor(palette, -3)).toEqual([1, 1, 1]);
    expect(getPaletteColor(palette, 14)).toEqual([200 / 255, 0, 0]);
  });
});
