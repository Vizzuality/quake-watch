import type { LngLat } from '@/lib/globe/map-felt-rings';

export const TILE_SIZE = 256;
export const RELIEF_ZOOM = 6;
export const TERRARIUM_TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';

const MERCATOR_MAX_LAT = 85.051129;

export type TileElevations = Map<string, Float32Array>;
export type ElevationSampler = (lon: number, lat: number) => number;

export function getTileKey(zoom: number, x: number, y: number): string {
  return `${zoom}/${x}/${y}`;
}

export function getTileUrl(key: string): string {
  return `${TERRARIUM_TILE_URL}/${key}.png`;
}

export function getTerrariumElevations(rgba: Uint8ClampedArray): Float32Array {
  const elevations = new Float32Array(rgba.length / 4);
  for (let index = 0; index < elevations.length; index++) {
    const offset = index * 4;
    elevations[index] = rgba[offset] * 256 + rgba[offset + 1] + rgba[offset + 2] / 256 - 32768;
  }
  return elevations;
}

export function getWorldPixel(lon: number, lat: number, zoom: number): { x: number; y: number } {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const phi = (Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, lat)) * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * worldSize,
    y: ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * worldSize,
  };
}

function getWrapped(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function getCornerPixels(lon: number, lat: number, zoom: number) {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const { x, y } = getWorldPixel(lon, lat, zoom);
  const left = Math.floor(x - 0.5);
  const top = Math.min(worldSize - 2, Math.max(0, Math.floor(y - 0.5)));
  return {
    columns: [getWrapped(left, worldSize), getWrapped(left + 1, worldSize)],
    rows: [top, top + 1],
    fx: x - 0.5 - left,
    fy: Math.min(1, Math.max(0, y - 0.5 - top)),
  };
}

function getPixelTileKey(zoom: number, column: number, row: number): string {
  return getTileKey(zoom, Math.floor(column / TILE_SIZE), Math.floor(row / TILE_SIZE));
}

export function getTileKeys(points: readonly LngLat[], zoom: number): string[] {
  const keys = new Set<string>();
  for (const [lon, lat] of points) {
    const { columns, rows } = getCornerPixels(lon, lat, zoom);
    for (const column of columns) {
      for (const row of rows) keys.add(getPixelTileKey(zoom, column, row));
    }
  }
  return [...keys].sort();
}

export function getElevationSampler(tiles: TileElevations, zoom: number): ElevationSampler {
  function getPixelElevation(column: number, row: number): number {
    const tile = tiles.get(getPixelTileKey(zoom, column, row));
    if (!tile) return 0;
    return tile[(row % TILE_SIZE) * TILE_SIZE + (column % TILE_SIZE)];
  }

  return (lon, lat) => {
    const { columns, rows, fx, fy } = getCornerPixels(lon, lat, zoom);
    const north =
      getPixelElevation(columns[0], rows[0]) * (1 - fx) +
      getPixelElevation(columns[1], rows[0]) * fx;
    const south =
      getPixelElevation(columns[0], rows[1]) * (1 - fx) +
      getPixelElevation(columns[1], rows[1]) * fx;
    return north * (1 - fy) + south * fy;
  };
}
