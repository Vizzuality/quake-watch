import { FELT_INTENSITY } from '@/lib/earthquakes/intensity';
import type { SearchCenter } from '@/lib/earthquakes/search-schema';
import { getCirclePosition } from '@/lib/map/search-area';
import { getMercatorY } from '@/lib/map/shaking-waves';

import type { ShakemapContour } from './contours';
import { getGridMmi, getPaletteColor } from './coverage';
import type { ShakemapGrid } from './coverage';

export type CanvasSize = { width: number; height: number };
export type CanvasPoint = readonly [number, number];
export type ShakemapCorners = [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
];
export type ContourPath = { mmi: number; color: string; lines: CanvasPoint[][] };

const FULL_TURN_DEG = 360;
const BYTES_PER_PIXEL = 4;
const REVEAL_OUTLINE_STEPS = 128;
const FELT_ALPHA = 0.35;
const FULL_ALPHA_INTENSITY = 5;

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

export function getSurfaceAlpha(mmi: number): number {
  if (mmi <= FELT_INTENSITY - 1) return 0;
  if (mmi < FELT_INTENSITY) return (mmi - (FELT_INTENSITY - 1)) * FELT_ALPHA;
  if (mmi >= FULL_ALPHA_INTENSITY) return 1;
  return (
    FELT_ALPHA +
    ((mmi - FELT_INTENSITY) / (FULL_ALPHA_INTENSITY - FELT_INTENSITY)) * (1 - FELT_ALPHA)
  );
}

export function getSurfacePixels(
  grid: ShakemapGrid,
  size: CanvasSize,
): Uint8ClampedArray<ArrayBuffer> {
  const pixels = new Uint8ClampedArray(size.width * size.height * BYTES_PER_PIXEL);
  const { top, height } = getMercatorSpan(grid);
  for (let y = 0; y < size.height; y++) {
    const latitude = getLatitudeFromMercatorY(top + ((y + 0.5) / size.height) * height);
    for (let x = 0; x < size.width; x++) {
      const longitude = grid.west + ((x + 0.5) / size.width) * (grid.east - grid.west);
      const mmi = getGridMmi(grid, longitude, latitude);
      if (mmi === null) continue;
      const [red, green, blue] = getPaletteColor(grid.palette, mmi);
      const offset = (y * size.width + x) * BYTES_PER_PIXEL;
      pixels[offset] = red * 255;
      pixels[offset + 1] = green * 255;
      pixels[offset + 2] = blue * 255;
      pixels[offset + 3] = getSurfaceAlpha(mmi) * 255;
    }
  }
  return pixels;
}

export function getContourPaths(
  grid: ShakemapGrid,
  size: CanvasSize,
  contours: readonly ShakemapContour[],
): ContourPath[] {
  return contours.map(({ mmi, color, lines }) => ({
    mmi,
    color,
    lines: lines.map((line) => line.map((position) => getCanvasPoint(grid, size, position))),
  }));
}

export function getRevealOutline(
  grid: ShakemapGrid,
  size: CanvasSize,
  epicenter: SearchCenter,
  radiusKm: number,
): CanvasPoint[] {
  return Array.from({ length: REVEAL_OUTLINE_STEPS }, (_, index) =>
    getCanvasPoint(
      grid,
      size,
      getCirclePosition(epicenter, radiusKm, (2 * Math.PI * index) / REVEAL_OUTLINE_STEPS),
    ),
  );
}

export function getGridMaxMmi(grid: ShakemapGrid): number | null {
  let max: number | null = null;
  for (const value of grid.values) {
    if (!Number.isNaN(value) && (max === null || value > max)) max = value;
  }
  return max;
}
