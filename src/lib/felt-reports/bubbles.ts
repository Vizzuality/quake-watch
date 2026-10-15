import type { ExpressionSpecification } from 'maplibre-gl';

import { getDistanceKm } from '@/lib/earthquakes/distance';
import type { SearchCenter } from '@/lib/earthquakes/search-schema';
import type { ShakemapPalette } from '@/lib/shakemap/coverage';
import { PULSE_WHITE_MIX } from '@/lib/shakemap/pulse';
import { getPulseExpression } from '@/lib/shakemap/pulse-expression';
import { S_WAVE_KM_S, getArrivalSeconds, getPulseLengthSeconds } from '@/lib/shakemap/wave';

import type { FeltReportCell } from './cells';
import { getNearestCells } from './framing';

export type BubbleProperties = { reports: number; mmiReports: number; arrival: number };
export type BubbleFeature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: BubbleProperties;
};
export type BubbleCollection = { type: 'FeatureCollection'; features: BubbleFeature[] };

export const BUBBLE_SECONDS_STATE = 'feltBubbleSeconds';
export const BUBBLE_CLUSTER_PROPERTIES: Record<keyof BubbleProperties, ExpressionSpecification> = {
  reports: ['+', ['get', 'reports']],
  mmiReports: ['+', ['get', 'mmiReports']],
  arrival: ['min', ['get', 'arrival']],
};

export const MIN_BUBBLE_RADIUS_PX = 5;
const BUBBLE_RADIUS_PER_SQRT_REPORT_PX = 1.6;
export const MAX_BUBBLE_RADIUS_PX = 34;
const PULSE_GROWTH = 0.35;
export const SETTLED_BUBBLE_OPACITY = 0.85;
const SETTLED_SECONDS = Number.MAX_SAFE_INTEGER;
const WHITE = 'rgb(255, 255, 255)';
const INK = '#0b0d10';
const LIGHT_TEXT_FROM_MMI = 8.5;

const REPORTS: ExpressionSpecification = ['get', 'reports'];
const BUBBLE_MMI: ExpressionSpecification = ['/', ['get', 'mmiReports'], REPORTS];
const SECONDS_SINCE_S: ExpressionSpecification = [
  '-',
  ['to-number', ['global-state', BUBBLE_SECONDS_STATE]],
  ['get', 'arrival'],
];
const BUBBLE_PULSE = getPulseExpression(SECONDS_SINCE_S, BUBBLE_MMI);

function getCellArrivalSeconds(
  cell: FeltReportCell,
  epicenter: SearchCenter,
  depthKm: number,
): number {
  return getArrivalSeconds(getDistanceKm(epicenter, cell), depthKm, S_WAVE_KM_S);
}

export function getBubbleFeatures(
  cells: readonly FeltReportCell[],
  epicenter: SearchCenter,
  depthKm: number,
): BubbleCollection {
  return {
    type: 'FeatureCollection',
    features: cells.map((cell) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [cell.longitude, cell.latitude] },
      properties: {
        reports: cell.count,
        mmiReports: cell.mmi * cell.count,
        arrival: getCellArrivalSeconds(cell, epicenter, depthKm),
      },
    })),
  };
}

export function getBubbleMmi({ reports, mmiReports }: BubbleProperties): number {
  return mmiReports / reports;
}

function getIsCountable(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function getBubbleProperties(
  properties: Record<string, unknown> | null | undefined,
): BubbleProperties | null {
  const { reports, mmiReports, arrival } = properties ?? {};
  if (!getIsCountable(reports) || !getIsCountable(mmiReports) || !getIsCountable(arrival)) {
    return null;
  }
  return reports > 0 ? { reports, mmiReports, arrival } : null;
}

export function getIsBubbleArrived(
  { arrival }: BubbleProperties,
  seconds: number,
  complete: boolean,
): boolean {
  return complete || arrival <= seconds;
}

export function getBubbleSeconds(seconds: number, complete: boolean): number {
  return complete ? SETTLED_SECONDS : seconds;
}

export function getBubbleRadius(reports: number): number {
  return Math.min(
    MAX_BUBBLE_RADIUS_PX,
    MIN_BUBBLE_RADIUS_PX + BUBBLE_RADIUS_PER_SQRT_REPORT_PX * Math.sqrt(Math.max(0, reports)),
  );
}

export function getBubbleRadiusExpression(): ExpressionSpecification {
  return [
    '*',
    [
      'min',
      MAX_BUBBLE_RADIUS_PX,
      ['+', MIN_BUBBLE_RADIUS_PX, ['*', BUBBLE_RADIUS_PER_SQRT_REPORT_PX, ['sqrt', REPORTS]]],
    ],
    ['+', 1, ['*', PULSE_GROWTH, BUBBLE_PULSE]],
  ];
}

function getPaletteStops({ colors, extent: [low, high] }: ShakemapPalette): Array<number | string> {
  const step = (high - low) / (colors.length - 1);
  return colors.flatMap((color, index) => [low + step * index, color]);
}

export function getBubbleColorExpression(palette: ShakemapPalette): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['*', BUBBLE_PULSE, PULSE_WHITE_MIX],
    0,
    ['interpolate', ['linear'], BUBBLE_MMI, ...getPaletteStops(palette)] as ExpressionSpecification,
    1,
    WHITE,
  ];
}

export function getBubbleArrivedExpression(arrived: number | ExpressionSpecification) {
  return ['case', ['<', SECONDS_SINCE_S, 0], 0, arrived] as ExpressionSpecification;
}

export function getBubbleOpacityExpression(): ExpressionSpecification {
  return getBubbleArrivedExpression([
    '+',
    SETTLED_BUBBLE_OPACITY,
    ['*', 1 - SETTLED_BUBBLE_OPACITY, BUBBLE_PULSE],
  ]);
}

export function getBubbleTextColorExpression(): ExpressionSpecification {
  return ['case', ['>=', BUBBLE_MMI, LIGHT_TEXT_FROM_MMI], WHITE, INK];
}

export function getStrongestCell(cells: readonly FeltReportCell[]): FeltReportCell | null {
  return cells.reduce<FeltReportCell | null>(
    (strongest, cell) => (strongest && strongest.mmi >= cell.mmi ? strongest : cell),
    null,
  );
}

export function getFramedRunEndSeconds(
  cells: readonly FeltReportCell[],
  epicenter: SearchCenter,
  depthKm: number,
): number {
  return getNearestCells(cells, epicenter).reduce(
    (end, cell) =>
      Math.max(
        end,
        getCellArrivalSeconds(cell, epicenter, depthKm) + getPulseLengthSeconds(cell.mmi),
      ),
    0,
  );
}
