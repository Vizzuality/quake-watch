import { describe, expect, it } from 'vitest';

import {
  TILE_SIZE,
  getElevationSampler,
  getTerrariumElevations,
  getTileKey,
  getTileKeys,
  getWorldPixel,
} from './terrarium';

function getTile(elevation: (x: number, y: number) => number): Float32Array {
  const elevations = new Float32Array(TILE_SIZE * TILE_SIZE);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) elevations[y * TILE_SIZE + x] = elevation(x, y);
  }
  return elevations;
}

describe('terrarium tiles', () => {
  it('decodes metres from the red, green and blue channels', () => {
    const rgba = new Uint8ClampedArray([128, 0, 0, 255, 116, 63, 128, 255]);

    expect(Array.from(getTerrariumElevations(rgba))).toEqual([0, -3008.5]);
  });

  it('projects longitude and latitude to Web Mercator world pixels', () => {
    expect(getWorldPixel(0, 0, 0)).toEqual({ x: 128, y: 128 });
    expect(getWorldPixel(180, 0, 1).x).toBeCloseTo(512);
    expect(getWorldPixel(0, 85.0511, 2).y).toBeCloseTo(0, 1);
  });

  it('lists each tile a set of points needs once, wrapping across the antimeridian', () => {
    const keys = getTileKeys(
      [
        [-179.9, 1],
        [-179.8, 1],
        [180.1, 1],
      ],
      2,
    );

    expect(keys).toEqual([getTileKey(2, 0, 1), getTileKey(2, 3, 1)]);
  });

  it('samples elevations bilinearly, including across a tile seam', () => {
    const zoom = 1;
    const tiles = new Map([
      [getTileKey(zoom, 0, 0), getTile((x) => x)],
      [getTileKey(zoom, 1, 0), getTile((x) => 256 + x)],
    ]);
    const sample = getElevationSampler(tiles, zoom);
    const seamLon = 0;
    const halfPixelLon = 360 / (TILE_SIZE * 2 ** zoom) / 2;

    expect(sample(seamLon - halfPixelLon * 3, 45)).toBeCloseTo(254);
    expect(sample(seamLon, 45)).toBeCloseTo(255.5);
  });

  it('reads sea level where a tile is missing', () => {
    const sample = getElevationSampler(new Map(), 3);

    expect(sample(10, 10)).toBe(0);
  });
});
