import { describe, expect, it } from 'vitest';

import {
  ISOMETRIC_CAMERA,
  getTerrariumElevationM,
  getTerrariumTiles,
  getTerrariumTileUrl,
  getTerrariumZoom,
} from './terrarium';

describe('getTerrariumElevationM', () => {
  it('decodes known pixels', () => {
    expect(getTerrariumElevationM(128, 0, 0)).toBe(0);
    expect(getTerrariumElevationM(0, 0, 0)).toBe(-32768);
    expect(getTerrariumElevationM(128, 10, 128)).toBe(10.5);
    expect(getTerrariumElevationM(127, 255, 0)).toBe(-1);
  });
});

describe('getTerrariumZoom', () => {
  const EQUATOR_KM = 40_075.017;

  function getTileSpan(blockSideKm: number, latitude: number): number {
    const tileKm =
      (EQUATOR_KM * Math.cos((latitude * Math.PI) / 180)) /
      2 ** getTerrariumZoom(blockSideKm, latitude);
    return blockSideKm / tileKm;
  }

  function getTileCounts(latitude: number, longitude: number, blockSideKm: number) {
    const tiles = getTerrariumTiles(
      latitude,
      longitude,
      blockSideKm,
      getTerrariumZoom(blockSideKm, latitude),
    );
    return {
      columns: new Set(tiles.map((tile) => tile.x)).size,
      rows: new Set(tiles.map((tile) => tile.y)).size,
    };
  }

  it('keeps the block between 1.5 and 3 tile widths at any latitude', () => {
    [0, 40.4, -40.4, 60, 75, -75].forEach((latitude) => {
      [60, 90, 200, 500, 980].forEach((side) => {
        expect(getTileSpan(side, latitude)).toBeGreaterThan(1.5);
        expect(getTileSpan(side, latitude)).toBeLessThanOrEqual(3);
      });
    });
  });

  it('fetches at most 4x4 tiles for a 60 km block at 40.4 degrees', () => {
    expect(getTerrariumZoom(60, 40.4)).toBe(10);
    const { columns, rows } = getTileCounts(40.4, -3.7, 60);
    expect(columns).toBeGreaterThanOrEqual(2);
    expect(columns).toBeLessThanOrEqual(4);
    expect(rows).toBeGreaterThanOrEqual(2);
    expect(rows).toBeLessThanOrEqual(4);
  });

  it('stays sane at 75 degrees', () => {
    expect(getTerrariumZoom(60, 75)).toBe(9);
    expect(getTerrariumZoom(980, 75)).toBe(4);
    const { columns, rows } = getTileCounts(75, 20, 200);
    expect(columns).toBeLessThanOrEqual(4);
    expect(rows).toBeLessThanOrEqual(4);
  });

  it('uses the full equator width at latitude 0', () => {
    [60, 980].forEach((side) => {
      expect(getTerrariumZoom(side, 0)).toBe(Math.floor(Math.log2((3 * EQUATOR_KM) / side)));
    });
    expect(getTerrariumZoom(60, 0)).toBe(10);
    expect(getTerrariumZoom(980, 0)).toBe(6);
  });

  it('clamps latitude to the Web Mercator limit', () => {
    expect(getTerrariumZoom(60, 90)).toBe(getTerrariumZoom(60, 85.051_128_78));
    expect(getTerrariumZoom(60, -90)).toBe(getTerrariumZoom(60, 85.051_128_78));
  });

  it('clamps zoom to 0..12', () => {
    expect(getTerrariumZoom(0, 0)).toBe(12);
    expect(getTerrariumZoom(1, 0)).toBe(12);
    expect(getTerrariumZoom(1_000_000, 0)).toBe(0);
  });
});

describe('getTerrariumTiles', () => {
  it('covers the bbox around a mid-latitude epicentre', () => {
    const tiles = getTerrariumTiles(40.4, -3.7, 60, 11);
    expect(tiles.length).toBeGreaterThanOrEqual(4);
    expect(tiles.length).toBeLessThanOrEqual(25);
    tiles.forEach((tile) => {
      expect(tile.z).toBe(11);
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.x).toBeLessThan(2 ** 11);
    });
    expect([...new Set(tiles.map((tile) => tile.x))]).toEqual([1000, 1001, 1002, 1003, 1004]);
    expect([...new Set(tiles.map((tile) => tile.y))]).toEqual([770, 771, 772, 773, 774]);
  });

  it('wraps x across the antimeridian without negative values', () => {
    const zoom = 7;
    const n = 2 ** zoom;
    [179.9, -179.9].forEach((longitude) => {
      const xs = getTerrariumTiles(-15, longitude, 200, zoom).map((tile) => tile.x);
      xs.forEach((x) => {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(n);
      });
      expect(xs).toContain(0);
      expect(xs).toContain(n - 1);
    });
  });

  it('needs more tile columns at high latitude', () => {
    const zoom = 8;
    const getColumns = (latitude: number) =>
      new Set(getTerrariumTiles(latitude, 10, 200, zoom).map((tile) => tile.x)).size;
    expect(getColumns(75)).toBeGreaterThan(getColumns(0));
  });

  it('keeps columns bounded at the poles', () => {
    [90, 89.9, -90].forEach((latitude) => {
      const tiles = getTerrariumTiles(latitude, 10, 60, getTerrariumZoom(60, latitude));
      expect(new Set(tiles.map((tile) => tile.x)).size).toBeLessThanOrEqual(4);
    });
  });

  it('returns each tile once when the bbox exceeds the world width', () => {
    const tiles = getTerrariumTiles(89, 0, 4000, 2);
    const keys = tiles.map((tile) => `${tile.x}/${tile.y}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(tiles.map((tile) => tile.x)).size).toBe(4);
    tiles.forEach((tile) => {
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeLessThan(4);
    });
  });
});

describe('getTerrariumTileUrl', () => {
  it('builds the AWS terrarium URL', () => {
    expect(getTerrariumTileUrl({ z: 11, x: 1002, y: 771 })).toBe(
      'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/11/1002/771.png',
    );
  });
});

describe('ISOMETRIC_CAMERA', () => {
  it('looks from 45 degrees azimuth at the true isometric elevation', () => {
    expect(ISOMETRIC_CAMERA.azimuthRad).toBe(Math.PI / 4);
    expect(ISOMETRIC_CAMERA.elevationRad).toBeCloseTo(0.6155, 4);
  });
});
