import { describe, expect, it } from 'vitest';

import {
  SCALE_BAR_MAX_PX,
  getScaleBar,
  getScaleBarLabels,
  getScaleBarMaxPx,
} from './map-scale-bar';

describe('getScaleBar', () => {
  it('picks the longest round distance that fits in 140 px, as the prototype does', () => {
    expect(SCALE_BAR_MAX_PX).toBe(140);
    expect(getScaleBar(200 / 118)).toEqual({ km: 200, widthPx: 118 });
  });

  it('steps down to the next round distance when the longer one would overflow', () => {
    expect(getScaleBar(1000 / 140)?.km).toBe(1000);
    expect(getScaleBar(1000 / (SCALE_BAR_MAX_PX + 1))?.km).toBe(500);
  });

  it('switches to metres when zoomed in to street level', () => {
    expect(getScaleBar(0.2 / 100)?.km).toBe(0.25);
  });

  it('draws nothing when the scale is unknown', () => {
    expect(getScaleBar(0)).toBeNull();
    expect(getScaleBar(Number.NaN)).toBeNull();
  });
});

describe('getScaleBarLabels', () => {
  it('labels the start, the middle and the end, with the unit only at the end', () => {
    expect(getScaleBarLabels({ km: 500, widthPx: 130 }, 'en')).toEqual({
      start: '0',
      mid: '250',
      end: '500 km',
    });
  });

  it('keeps the middle in the same unit as the end', () => {
    expect(getScaleBarLabels({ km: 0.5, widthPx: 130 }, 'en')).toEqual({
      start: '0',
      mid: '250',
      end: '500 m',
    });
    expect(getScaleBarLabels({ km: 2.5, widthPx: 130 }, 'es').end).toBe('2,5 km');
  });

  it('drops the middle label on bars of 120 px or less, like the 200 km bar of the target', () => {
    expect(getScaleBarLabels({ km: 200, widthPx: 118 }, 'en').mid).toBeNull();
  });
});

describe('getScaleBarMaxPx', () => {
  it('keeps the 140 px bar on desktop', () => {
    expect(getScaleBarMaxPx(1440, 900)).toBe(SCALE_BAR_MAX_PX);
  });

  it('shortens the bar on phones so it stays clear of the centred quake at 320 px', () => {
    const maxPx = getScaleBarMaxPx(320, 640);
    expect(320 - 18 - maxPx - 4).toBeGreaterThan(320 / 2 + 12 + 8);
  });
});
