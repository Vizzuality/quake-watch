import { z } from 'zod';

import { EarthquakeSourceError } from '@/lib/earthquakes/query-options';
import type { Rgb } from '@/lib/map/shaking-waves';

const FULL_TURN_DEG = 360;
const RGB_PATTERN = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/;

export type ShakemapPalette = { colors: readonly string[]; extent: readonly [number, number] };

export type ShakemapGrid = {
  west: number;
  east: number;
  south: number;
  north: number;
  columns: number;
  rows: number;
  values: Float32Array;
  palette: ShakemapPalette;
};

const axisSchema = z.object({
  start: z.number(),
  stop: z.number(),
  num: z.number().int().min(2),
});

const coverageSchema = z
  .object({
    domain: z.object({ axes: z.object({ x: axisSchema, y: axisSchema }) }),
    parameters: z.object({
      MMI: z.object({
        preferredPalette: z.object({
          colors: z.array(z.string().regex(RGB_PATTERN)).min(1),
          extent: z.tuple([z.number(), z.number()]),
        }),
      }),
    }),
    ranges: z.object({
      MMI: z.object({
        axisNames: z.tuple([z.literal('y'), z.literal('x')]),
        shape: z.tuple([z.number().int(), z.number().int()]),
        values: z.array(z.number().nullable()),
      }),
    }),
  })
  .refine(({ domain, ranges }) => {
    const { x, y } = domain.axes;
    const { shape, values } = ranges.MMI;
    return (
      y.stop > y.start &&
      shape[0] === y.num &&
      shape[1] === x.num &&
      values.length === x.num * y.num
    );
  })
  .refine(({ parameters }) => {
    const [low, high] = parameters.MMI.preferredPalette.extent;
    return high > low;
  });

export function getShakemapGrid(json: unknown): ShakemapGrid {
  const parsed = coverageSchema.safeParse(json);
  if (!parsed.success) throw new EarthquakeSourceError('usgs', 200);
  const { domain, parameters, ranges } = parsed.data;
  const { x, y } = domain.axes;
  return {
    west: x.start,
    east: x.stop < x.start ? x.stop + FULL_TURN_DEG : x.stop,
    south: y.start,
    north: y.stop,
    columns: x.num,
    rows: y.num,
    values: Float32Array.from(ranges.MMI.values, (value) => value ?? Number.NaN),
    palette: parameters.MMI.preferredPalette,
  };
}

export function getGridLongitude(grid: ShakemapGrid, column: number): number {
  return grid.west + (column * (grid.east - grid.west)) / (grid.columns - 1);
}

export function getGridLatitude(grid: ShakemapGrid, row: number): number {
  return grid.south + (row * (grid.north - grid.south)) / (grid.rows - 1);
}

function getLongitudeInGridFrame(grid: ShakemapGrid, longitude: number): number {
  return grid.west + ((((longitude - grid.west) % FULL_TURN_DEG) + FULL_TURN_DEG) % FULL_TURN_DEG);
}

export function getGridMmi(grid: ShakemapGrid, longitude: number, latitude: number): number | null {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  const framedLongitude = getLongitudeInGridFrame(grid, longitude);
  if (framedLongitude > grid.east || latitude < grid.south || latitude > grid.north) return null;
  const column = Math.round(
    ((framedLongitude - grid.west) / (grid.east - grid.west)) * (grid.columns - 1),
  );
  const row = Math.round(((latitude - grid.south) / (grid.north - grid.south)) * (grid.rows - 1));
  const value = grid.values[row * grid.columns + column];
  return Number.isNaN(value) ? null : value;
}

function getRgbFromCss(color: string): Rgb {
  const [, red, green, blue] = RGB_PATTERN.exec(color) ?? [];
  return [Number(red) / 255, Number(green) / 255, Number(blue) / 255];
}

export function getPaletteColor(palette: ShakemapPalette, mmi: number): Rgb {
  const [low, high] = palette.extent;
  const clamped = Math.min(high, Math.max(low, mmi));
  const position = ((clamped - low) / (high - low)) * (palette.colors.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.min(palette.colors.length - 1, lowerIndex + 1);
  const weight = position - lowerIndex;
  const from = getRgbFromCss(palette.colors[lowerIndex]);
  const to = getRgbFromCss(palette.colors[upperIndex]);
  return [
    from[0] + (to[0] - from[0]) * weight,
    from[1] + (to[1] - from[1]) * weight,
    from[2] + (to[2] - from[2]) * weight,
  ];
}
