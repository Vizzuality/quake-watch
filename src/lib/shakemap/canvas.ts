import { getDistanceKm } from '@/lib/earthquakes/distance';
import type { SearchCenter } from '@/lib/earthquakes/search-schema';
import { getMercatorY } from '@/lib/map/shaking-waves';

import { getGridMmi, getPaletteColor } from './coverage';
import type { ShakemapGrid } from './coverage';
import { type PulsePoint, type PulseRaster, getPulseRaster } from './pulse';
import { S_WAVE_KM_S, getArrivalSeconds } from './wave';

export type CanvasSize = { width: number; height: number };
export type CanvasPoint = readonly [number, number];
export type ShakemapCorners = [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
];

const FULL_TURN_DEG = 360;
export const FILL_MIN_MMI = 4;

function getLatitudeFromMercatorY(y: number): number {
  return ((2 * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 2) * 180) / Math.PI;
}

function getMercatorSpan(grid: ShakemapGrid): { top: number; height: number } {
  const top = getMercatorY(grid.north);
  return { top, height: getMercatorY(grid.south) - top };
}

export function getShakemapCorners(grid: ShakemapGrid): ShakemapCorners {
  return [
    [grid.west, grid.north],
    [grid.east, grid.north],
    [grid.east, grid.south],
    [grid.west, grid.south],
  ];
}

export function getShakemapCanvasSize(grid: ShakemapGrid, longSidePx: number): CanvasSize {
  const width = (grid.east - grid.west) / FULL_TURN_DEG;
  const { height } = getMercatorSpan(grid);
  const scale = longSidePx / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function getCanvasPoint(
  grid: ShakemapGrid,
  size: CanvasSize,
  [longitude, latitude]: readonly [number, number],
): CanvasPoint {
  const center = (grid.west + grid.east) / 2;
  const framedLongitude =
    longitude + FULL_TURN_DEG * Math.round((center - longitude) / FULL_TURN_DEG);
  const { top, height } = getMercatorSpan(grid);
  return [
    ((framedLongitude - grid.west) / (grid.east - grid.west)) * size.width,
    ((getMercatorY(latitude) - top) / height) * size.height,
  ];
}

function visitSurface(
  grid: ShakemapGrid,
  size: CanvasSize,
  visit: (index: number, mmi: number, position: SearchCenter) => void,
) {
  const { top, height } = getMercatorSpan(grid);
  for (let y = 0; y < size.height; y++) {
    const latitude = getLatitudeFromMercatorY(top + ((y + 0.5) / size.height) * height);
    for (let x = 0; x < size.width; x++) {
      const longitude = grid.west + ((x + 0.5) / size.width) * (grid.east - grid.west);
      const mmi = getGridMmi(grid, longitude, latitude);
      if (mmi !== null && mmi >= FILL_MIN_MMI) {
        visit(y * size.width + x, mmi, { latitude, longitude });
      }
    }
  }
}

export function getSurfaceRaster(
  grid: ShakemapGrid,
  size: CanvasSize,
  epicenter: SearchCenter,
  depthKm: number,
): PulseRaster {
  const points: PulsePoint[] = [];
  visitSurface(grid, size, (pixel, mmi, position) => {
    points.push({
      pixel,
      mmi,
      arrival: getArrivalSeconds(getDistanceKm(epicenter, position), depthKm, S_WAVE_KM_S),
      rgb: getPaletteColor(grid.palette, mmi).map((channel) => channel * 255),
    });
  });
  return getPulseRaster(size.width, size.height, points);
}

export function getGridMaxMmi(grid: ShakemapGrid): number | null {
  let max: number | null = null;
  for (const value of grid.values) {
    if (!Number.isNaN(value) && (max === null || value > max)) max = value;
  }
  return max;
}
