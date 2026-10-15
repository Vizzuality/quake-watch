import { describe, expect, it } from 'vitest';

import {
  PULSE_WHITE_MIX,
  SETTLED_ALPHA,
  getPulseFrameBuffer,
  getPulseRaster,
  getSettledSeconds,
  paintPulseFrame,
} from './pulse';
import { getPulse, getPulseLengthSeconds } from './wave';

const raster = getPulseRaster(3, 1, [
  { pixel: 0, arrival: 10, mmi: 8, rgb: [255, 0, 0] },
  { pixel: 2, arrival: 30, mmi: 4, rgb: [0, 100, 200] },
]);

function getPixel(pixels: Uint8ClampedArray, pixel: number): number[] {
  return Array.from(pixels.slice(pixel * 4, pixel * 4 + 4));
}

describe('getPulseRaster', () => {
  it('packs the points into typed arrays', () => {
    expect(Array.from(raster.pixels)).toEqual([0, 2]);
    expect(Array.from(raster.arrivals)).toEqual([10, 30]);
    expect(Array.from(raster.intensities)).toEqual([8, 4]);
    expect(Array.from(raster.colors)).toEqual([255, 0, 0, 0, 100, 200]);
    expect(getPulseFrameBuffer(raster)).toHaveLength(12);
  });
});

describe('paintPulseFrame', () => {
  it('paints nothing where the S wave has not arrived yet', () => {
    const pixels = getPulseFrameBuffer(raster);
    paintPulseFrame(pixels, raster, 5, false);
    expect(pixels.every((byte) => byte === 0)).toBe(true);
  });

  it('brightens a point toward white while its pulse is active', () => {
    const pixels = getPulseFrameBuffer(raster);
    paintPulseFrame(pixels, raster, 12, false);
    const pulse = getPulse(2, 8);
    const [red, green, blue, alpha] = getPixel(pixels, 0);
    expect(pulse).toBeGreaterThan(0);
    expect(red).toBe(255);
    expect(green).toBe(Math.round(255 * pulse * PULSE_WHITE_MIX));
    expect(blue).toBe(green);
    expect(alpha).toBeGreaterThan(SETTLED_ALPHA);
    expect(getPixel(pixels, 2)[3]).toBe(0);
  });

  it('settles to the base color once the pulse is over', () => {
    const pixels = getPulseFrameBuffer(raster);
    paintPulseFrame(pixels, raster, 200, false);
    expect(getPixel(pixels, 0)).toEqual([255, 0, 0, SETTLED_ALPHA]);
    expect(getPixel(pixels, 2)).toEqual([0, 100, 200, SETTLED_ALPHA]);
  });

  it('paints every point settled, at any time, in the final state', () => {
    const pixels = getPulseFrameBuffer(raster);
    paintPulseFrame(pixels, raster, 0, true);
    expect(getPixel(pixels, 2)).toEqual([0, 100, 200, SETTLED_ALPHA]);
  });

  it('clears points again when seeking back before their arrival', () => {
    const pixels = getPulseFrameBuffer(raster);
    paintPulseFrame(pixels, raster, 200, false);
    paintPulseFrame(pixels, raster, 20, false);
    expect(getPixel(pixels, 2)[3]).toBe(0);
  });
});

describe('getSettledSeconds', () => {
  it('is when the last point finishes its pulse', () => {
    expect(getSettledSeconds(raster)).toBe(
      Math.max(10 + getPulseLengthSeconds(8), 30 + getPulseLengthSeconds(4)),
    );
    expect(getPulse(getSettledSeconds(raster) - 30, 4)).toBe(0);
    expect(getSettledSeconds(getPulseRaster(1, 1, []))).toBe(0);
  });
});
