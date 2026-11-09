import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEPTH_COLOR_STOPS, getDepthColor, getDepthRgb } from './depth-color';

function getStopRgb(index: number): string {
  const [, r, g, b] = DEPTH_COLOR_STOPS[index];
  return `rgb(${r}, ${g}, ${b})`;
}

describe('getDepthColor', () => {
  it.each(DEPTH_COLOR_STOPS.map((stop, index) => [stop[0], index]))(
    'returns the exact stop colour at %i km',
    (km, index) => {
      expect(getDepthColor(km)).toBe(getStopRgb(index));
    },
  );

  it('clamps depths beyond the last stop', () => {
    expect(getDepthColor(800)).toBe('rgb(79, 123, 255)');
  });

  it('clamps negative depths to the first stop', () => {
    expect(getDepthColor(-5)).toBe(getStopRgb(0));
  });

  it('falls back to the first stop for NaN', () => {
    expect(getDepthColor(Number.NaN)).toBe(getStopRgb(0));
  });

  it('interpolates linearly between stops', () => {
    expect(getDepthColor(35)).toBe('rgb(255, 124, 93)');
  });
});

describe('getDepthRgb', () => {
  it.each(DEPTH_COLOR_STOPS.map((stop) => [stop[0], stop.slice(1)]))(
    'returns the stop channels at %i km',
    (km, channels) => {
      expect(getDepthRgb(km)).toEqual(channels);
    },
  );

  it('interpolates unrounded channels between stops', () => {
    expect(getDepthRgb(35)).toEqual([255, 124, 92.5]);
  });
});

describe('depth tokens in styles.css', () => {
  it('match DEPTH_COLOR_STOPS', () => {
    const css = readFileSync(path.resolve(import.meta.dirname, '../../styles.css'), 'utf8');
    const matches = [...css.matchAll(/--color-depth-(\d+):\s*#([0-9a-f]{6})/gi)];

    expect(matches).toHaveLength(DEPTH_COLOR_STOPS.length);
    for (const [, km, hex] of matches) {
      const channels = [0, 2, 4].map((offset) =>
        Number.parseInt(hex.slice(offset, offset + 2), 16),
      );
      const stop = DEPTH_COLOR_STOPS.find(([stopKm]) => stopKm === Number(km));
      expect(stop).toEqual([Number(km), ...channels]);
    }
  });
});
