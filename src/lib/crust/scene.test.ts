import { describe, expect, it } from 'vitest';

import { KM_PER_DEGREE } from './block';
import {
  BAND_KINDS,
  getBlockFit,
  getBlockLabels,
  getBlockMeshData,
  getBoundaryField,
  getColumnBands,
  getCrustalBlock,
  getCrustCellsInput,
  getDepthTicks,
  getElevationGrid,
  getGeoPoint,
  getLocalKm,
  getProjectedBounds,
  getRampColor,
  getRgb,
  getSurfaceKm,
  type Band,
  type RGB,
  type TilePixels,
} from './scene';
import type { CrustCell } from './types';

function getCell(
  latitude: number,
  longitude: number,
  boundaryElevationsKm: readonly number[],
): CrustCell {
  return { latitude, longitude, boundaryElevationsKm };
}

const MADRID = [0.8, 0.8, 0.8, -0.2, -2.0, -2.0, -11.83, -21.65, -31.77];
const OCEAN = [0, -4.5, -4.5, -4.8, -5.0, -5.0, -6.5, -8.5, -11.0];
const MADRID_CELL = getCell(40.5, -3.5, MADRID);
const MADRID_ORIGIN = { latitude: 40.4, longitude: -3.7 };

function getBand(bands: Band[], kind: Band['kind']): Band {
  return bands.find((band) => band.kind === kind)!;
}

function getThickness(band: Band): number {
  return band.topKm - band.bottomKm;
}

const GREY: RGB = [0.5, 0.5, 0.5];
const getColor = () => GREY;

describe('getLocalKm', () => {
  it('puts the origin at zero', () => {
    expect(getLocalKm(MADRID_ORIGIN, MADRID_ORIGIN)).toEqual({ x: 0, z: -0 });
  });

  it('maps north to negative z and east to positive x', () => {
    const origin = { latitude: 60, longitude: 10 };
    const north = getLocalKm({ latitude: 61, longitude: 10 }, origin);
    const east = getLocalKm({ latitude: 60, longitude: 11 }, origin);
    expect(north.z).toBeCloseTo(-KM_PER_DEGREE, 6);
    expect(east.x).toBeCloseTo(KM_PER_DEGREE / 2, 6);
  });

  it('crosses the antimeridian the short way', () => {
    const origin = { latitude: 0, longitude: 179.5 };
    expect(getLocalKm({ latitude: 0, longitude: -179.5 }, origin).x).toBeCloseTo(KM_PER_DEGREE, 6);
  });
});

describe('getGeoPoint', () => {
  it('inverts getLocalKm, wrapping longitude', () => {
    const origin = { latitude: -20.5, longitude: 179.8 };
    const point = getGeoPoint({ x: 50, z: -30 }, origin);
    const local = getLocalKm(point, origin);
    expect(local.x).toBeCloseTo(50, 6);
    expect(local.z).toBeCloseTo(-30, 6);
    expect(point.longitude).toBeLessThan(-179);
  });
});

describe('getCrustCellsInput', () => {
  it('sizes the radius for a deep Moho upper bound', () => {
    expect(getCrustCellsInput(MADRID_ORIGIN, 10)).toEqual({ ...MADRID_ORIGIN, radiusCells: 1 });
  });

  it('grows the radius for deep earthquakes', () => {
    expect(getCrustCellsInput({ latitude: -20.5, longitude: -178.5 }, 600).radiusCells).toBe(5);
  });
});

describe('getCrustalBlock', () => {
  it('derives the block from the Epicenter cell', () => {
    const cells = [MADRID_CELL, getCell(48.5, -3.5, OCEAN)];
    const block = getCrustalBlock(cells, MADRID_ORIGIN, 10);
    block.epicenterColumn.boundaryElevationsKm.forEach((value, index) =>
      expect(value).toBeCloseTo(MADRID[index], 6),
    );
    expect(block.mohoDepthKm).toBeCloseTo(31.77, 6);
    expect(block.blockDepthKm).toBe(60);
    expect(block.sideKm).toBe(60);
    expect(block.ruptureStartDepthKm).toBe(10);
    expect(block.deepBoundaries).toEqual([]);
    expect(block.layers.map((layer) => layer.kind)).toEqual([
      'upper-sediments',
      'middle-sediments',
      'upper-crust',
      'middle-crust',
      'lower-crust',
    ]);
    expect(block.blockCells).toEqual([MADRID_CELL]);
  });

  it('reads the Epicenter column from the same blended field as the 3D block', () => {
    const cells = [MADRID_CELL, getCell(40.5, -2.5, OCEAN)];
    const origin = { latitude: 40.5, longitude: -3 };
    const block = getCrustalBlock(cells, origin, 10);
    const sceneMohoKm = getBoundaryField(cells, origin)({ x: 0, z: 0 })[8];
    expect(block.mohoDepthKm).toBeCloseTo(-sceneMohoKm, 6);
    expect(block.mohoDepthKm).toBeCloseTo((31.77 + 11) / 2, 6);
    expect(block.layers.at(-1)?.bottomKm).toBeCloseTo(block.mohoDepthKm, 6);
  });

  it('lists the deep boundaries inside a deep block', () => {
    const block = getCrustalBlock(
      [getCell(-20.5, -178.5, OCEAN)],
      { latitude: -20.5, longitude: -178.5 },
      600,
    );
    expect(block.blockDepthKm).toBe(840);
    expect(block.deepBoundaries.map((boundary) => boundary.kind)).toEqual([
      'transition-zone-top',
      'lower-mantle-top',
    ]);
  });
});

describe('getBoundaryField', () => {
  const cells = [getCell(40.5, -3.5, MADRID), getCell(40.5, -2.5, OCEAN)];
  const origin = { latitude: 40.5, longitude: -3.5 };

  it('returns the cell values at a cell centre', () => {
    const field = getBoundaryField(cells, origin);
    field({ x: 0, z: 0 }).forEach((value, index) => expect(value).toBeCloseTo(MADRID[index], 6));
  });

  it('interpolates halfway between two cells', () => {
    const field = getBoundaryField(cells, origin);
    const x = getLocalKm({ latitude: 40.5, longitude: -3 }, origin).x;
    expect(field({ x, z: 0 })[8]).toBeCloseTo((MADRID[8] + OCEAN[8]) / 2, 6);
  });

  it('keeps blended coastal water between sea level and the sea floor', () => {
    const coast = [
      getCell(40.5, -3.5, MADRID),
      getCell(40.5, -2.5, [0, -0.6, -0.6, -0.8, -1, -1, -6, -10, -20]),
    ];
    const field = getBoundaryField(coast, { latitude: 40.5, longitude: -3.5 });
    const landward = field({
      x: getLocalKm({ latitude: 40.5, longitude: -3.2 }, { latitude: 40.5, longitude: -3.5 }).x,
      z: 0,
    });
    expect(landward[0]).toBe(landward[1]);
    const seaward = field({
      x: getLocalKm({ latitude: 40.5, longitude: -2.7 }, { latitude: 40.5, longitude: -3.5 }).x,
      z: 0,
    });
    expect(seaward[0]).toBe(0);
    expect(seaward[1]).toBeLessThan(0);
  });

  it('extends the nearest cell where cells are missing', () => {
    const field = getBoundaryField([MADRID_CELL], MADRID_ORIGIN);
    field({ x: -200, z: 300 }).forEach((value, index) =>
      expect(value).toBeCloseTo(MADRID[index], 6),
    );
  });
});

function getTerrariumPixel(elevationM: number): [number, number, number, number] {
  const value = elevationM + 32768;
  return [Math.floor(value / 256), Math.floor(value % 256), 0, 255];
}

function getUniformTile(
  tile: TilePixels['tile'],
  elevationM: number,
  size = 4,
): TilePixels & { data: Uint8ClampedArray } {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let index = 0; index < size * size; index++) {
    data.set(getTerrariumPixel(elevationM), index * 4);
  }
  return { tile, width: size, height: size, data };
}

describe('getElevationGrid', () => {
  it('samples every vertex from the tiles', () => {
    const grid = getElevationGrid(
      [getUniformTile({ z: 0, x: 0, y: 0 }, 1000)],
      MADRID_ORIGIN,
      60,
      4,
    );
    expect(grid?.segments).toBe(4);
    expect(grid?.elevationsM).toHaveLength(25);
    grid?.elevationsM.forEach((value) => expect(value).toBeCloseTo(1000, 6));
  });

  it('interpolates between neighbouring pixels', () => {
    const tile = getUniformTile({ z: 0, x: 0, y: 0 }, 0, 2);
    tile.data.set(getTerrariumPixel(1000), 4);
    tile.data.set(getTerrariumPixel(1000), 12);
    const grid = getElevationGrid([tile], { latitude: 0, longitude: 0 }, 1, 2);
    expect(grid?.elevationsM[4]).toBeCloseTo(500, 0);
  });

  it('falls back to the nearest pixel when a neighbour tile is missing', () => {
    const grid = getElevationGrid(
      [getUniformTile({ z: 1, x: 0, y: 0 }, 1000)],
      { latitude: 40, longitude: -0.01 },
      1,
      2,
    );
    grid?.elevationsM.forEach((value) => expect(value).toBeCloseTo(1000, 6));
    expect(grid).not.toBeNull();
  });

  it('returns null when a tile is missing', () => {
    const grid = getElevationGrid(
      [getUniformTile({ z: 1, x: 1, y: 1 }, 1000)],
      MADRID_ORIGIN,
      60,
      4,
    );
    expect(grid).toBeNull();
  });

  it('returns null without tiles', () => {
    expect(getElevationGrid([], MADRID_ORIGIN, 60, 4)).toBeNull();
  });
});

describe('getSurfaceKm', () => {
  it('exaggerates the relief around the CRUST1.0 ground top', () => {
    expect(getSurfaceKm(0.8, 0.9)).toBeCloseTo(1.8, 6);
    expect(getSurfaceKm(-4, -4.5)).toBeCloseTo(-9, 6);
  });

  it('keeps the sea floor under sea level', () => {
    expect(getSurfaceKm(-4, -0.1)).toBe(-0.1);
  });

  it('keeps land above sea level', () => {
    expect(getSurfaceKm(0.8, 0.05)).toBe(0.05);
  });

  it.each([0.8, -4.5])('never draws lower terrain higher (ground %s km)', (groundTopKm) => {
    const elevationsKm = Array.from({ length: 1201 }, (_, index) => -6 + index * 0.01);
    const surfacesKm = elevationsKm.map((elevationKm) => getSurfaceKm(groundTopKm, elevationKm));
    surfacesKm.slice(1).forEach((surfaceKm, index) => {
      expect(surfaceKm).toBeGreaterThanOrEqual(surfacesKm[index]);
    });
  });
});

describe('getColumnBands', () => {
  it('returns every band kind in drawing order', () => {
    expect(getColumnBands(MADRID, 0.8, false, 60).map((band) => band.kind)).toEqual(BAND_KINDS);
  });

  it('follows CRUST1.0 below a surface at the ground top', () => {
    const bands = getColumnBands(MADRID, 0.8, false, 60);
    expect(getBand(bands, 'upper-sediments')).toEqual({
      kind: 'upper-sediments',
      topKm: 0.8,
      bottomKm: -0.2,
    });
    expect(getBand(bands, 'upper-crust')).toEqual({
      kind: 'upper-crust',
      topKm: -2,
      bottomKm: -11.83,
    });
    expect(getThickness(getBand(bands, 'water'))).toBe(0);
    expect(getThickness(getBand(bands, 'ice'))).toBe(0);
  });

  it('stretches the topmost layer up to a raised surface', () => {
    const bands = getColumnBands(MADRID, 2, false, 60);
    expect(getBand(bands, 'upper-sediments').topKm).toBe(2);
    expect(getThickness(getBand(bands, 'ice'))).toBe(0);
  });

  it('cuts layers above a lowered surface', () => {
    const bands = getColumnBands(MADRID, -1, false, 60);
    expect(getThickness(getBand(bands, 'upper-sediments'))).toBe(0);
    expect(getBand(bands, 'middle-sediments').topKm).toBe(-1);
  });

  it('fills water from sea level down to the sea floor', () => {
    const bands = getColumnBands(OCEAN, -6, true, 60);
    expect(getBand(bands, 'water')).toEqual({ kind: 'water', topKm: 0, bottomKm: -6 });
    expect(getThickness(getBand(bands, 'upper-sediments'))).toBe(0);
  });

  it('splits the mantle at the PREM boundaries inside the block', () => {
    const shallow = getColumnBands(MADRID, 0.8, false, 60);
    expect(getBand(shallow, 'upper-mantle')).toEqual({
      kind: 'upper-mantle',
      topKm: -31.77,
      bottomKm: -60,
    });
    expect(getThickness(getBand(shallow, 'transition-zone'))).toBe(0);
    const deep = getColumnBands(OCEAN, -4.5, true, 840);
    expect(getBand(deep, 'transition-zone')).toEqual({
      kind: 'transition-zone',
      topKm: -400,
      bottomKm: -670,
    });
    expect(getBand(deep, 'lower-mantle')).toEqual({
      kind: 'lower-mantle',
      topKm: -670,
      bottomKm: -840,
    });
  });
});

describe('getBlockMeshData', () => {
  const input = {
    cells: [MADRID_CELL],
    origin: MADRID_ORIGIN,
    sideKm: 60,
    blockDepthKm: 60,
    segments: 4,
    relief: null,
    getBandColor: getColor,
    getTerrainColor: getColor,
  };

  it('builds a terrain mesh without the cut-away quadrant', () => {
    const mesh = getBlockMeshData(input);
    expect(mesh.terrain.positions).toHaveLength(25 * 3);
    expect(mesh.terrain.colors).toHaveLength(25 * 3);
    expect(mesh.terrain.indices).toHaveLength(12 * 6);
    expect(mesh.topKm).toBeCloseTo(0.8, 6);
    expect(mesh.surfaceAtCenterKm).toBeCloseTo(0.8, 6);
  });

  it('builds walls but no water on land', () => {
    const mesh = getBlockMeshData(input);
    expect(mesh.walls.indices.length).toBeGreaterThan(0);
    expect(mesh.water.indices).toHaveLength(0);
    expect(mesh.outlines.length % 6).toBe(0);
    expect(mesh.mohoLine.length).toBeGreaterThan(0);
    expect(mesh.deepLines).toHaveLength(0);
  });

  it('builds water at sea and lines for deep boundaries', () => {
    const mesh = getBlockMeshData({
      ...input,
      cells: [getCell(40.5, -3.5, OCEAN)],
      blockDepthKm: 500,
    });
    expect(mesh.water.indices.length).toBeGreaterThan(0);
    expect(mesh.deepLines.length).toBeGreaterThan(0);
  });

  it('draws no water over land below sea level', () => {
    const relief = { segments: 4, sideKm: 60, elevationsM: new Float32Array(25).fill(-100) };
    const mesh = getBlockMeshData({ ...input, relief });
    expect(mesh.water.indices).toHaveLength(0);
  });

  it('lifts the surface with the relief grid', () => {
    const relief = { segments: 4, sideKm: 60, elevationsM: new Float32Array(25).fill(900) };
    const mesh = getBlockMeshData({ ...input, relief });
    expect(mesh.surfaceAtCenterKm).toBeCloseTo(1.8, 5);
    expect(mesh.topKm).toBeCloseTo(1.8, 5);
  });

  it('ignores a relief grid of another resolution', () => {
    const relief = { segments: 2, sideKm: 60, elevationsM: new Float32Array(9).fill(900) };
    expect(getBlockMeshData({ ...input, relief }).surfaceAtCenterKm).toBeCloseTo(0.8, 6);
  });
});

describe('getBlockLabels', () => {
  it('labels crust, Moho and mantle from the top down', () => {
    const labels = getBlockLabels(getColumnBands(MADRID, 0.8, false, 60), 4);
    expect(labels.map((label) => label.kind)).toEqual(['crust', 'moho', 'upper-mantle']);
    expect(labels[1].yKm).toBeCloseTo(-31.77, 6);
  });

  it('drops lower-priority labels that would overlap', () => {
    const labels = getBlockLabels(getColumnBands(OCEAN, -4.5, true, 840), 40);
    expect(labels.map((label) => label.kind)).toEqual([
      'moho',
      'upper-mantle',
      'transition-zone',
      'lower-mantle',
    ]);
  });

  it('labels the water at sea', () => {
    const labels = getBlockLabels(getColumnBands(OCEAN, -4.5, true, 60), 1);
    expect(labels[0].kind).toBe('water');
  });
});

describe('getDepthTicks', () => {
  it('picks round steps', () => {
    expect(getDepthTicks(60)).toEqual([0, 20, 40, 60]);
    expect(getDepthTicks(840)).toEqual([0, 200, 400, 600, 800]);
    expect(getDepthTicks(5000)).toEqual([0, 1000, 2000, 3000, 4000, 5000]);
  });
});

describe('getProjectedBounds', () => {
  it('projects points onto the camera plane', () => {
    const bounds = getProjectedBounds(
      [
        [1, 0, -1],
        [-1, 0, 1],
        [0, 1, 0],
        [0, -1, 0],
      ],
      Math.PI / 4,
      0,
    );
    expect(bounds.minX).toBeCloseTo(-Math.SQRT2, 6);
    expect(bounds.maxX).toBeCloseTo(Math.SQRT2, 6);
    expect(bounds.minY).toBeCloseTo(-1, 6);
    expect(bounds.maxY).toBeCloseTo(1, 6);
  });
});

describe('getRampColor', () => {
  const stops = [
    { value: 0, color: [0, 0, 0] as RGB },
    { value: 10, color: [1, 0.5, 0] as RGB },
  ];

  it('clamps outside the stops', () => {
    expect(getRampColor(stops, -5)).toEqual([0, 0, 0]);
    expect(getRampColor(stops, 50)).toEqual([1, 0.5, 0]);
  });

  it('interpolates between stops', () => {
    expect(getRampColor(stops, 5)).toEqual([0.5, 0.25, 0]);
  });
});

describe('getRgb', () => {
  it('parses a hex colour into 0–1 channels', () => {
    const [r, g, b] = getRgb('#ff8000');
    expect(r).toBe(1);
    expect(g).toBeCloseTo(128 / 255, 6);
    expect(b).toBe(0);
  });
});

describe('getBlockFit', () => {
  const view = { azimuthRad: Math.PI / 4, elevationRad: 0 };

  it('scales the block to the available box', () => {
    const fit = getBlockFit({
      sideKm: 2,
      topKm: 1,
      bottomKm: -1,
      width: 400,
      height: 200,
      gutterX: 0,
      gutterY: 0,
      view,
    });
    expect(fit.scale).toBeCloseTo(100, 6);
  });

  it('centres the projected block on the origin', () => {
    const fit = getBlockFit({
      sideKm: 2,
      topKm: 3,
      bottomKm: -1,
      width: 1000,
      height: 400,
      gutterX: 50,
      gutterY: 0,
      view,
    });
    expect(fit.scale).toBeCloseTo(100, 6);
    expect(fit.position[1]).toBeCloseTo(-100, 6);
    expect(fit.position[0]).toBeCloseTo(0, 6);
  });
});
