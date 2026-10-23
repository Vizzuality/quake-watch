import type { ExpressionSpecification } from 'maplibre-gl';

import type { ShakemapPalette } from '@/lib/shakemap/coverage';

import type { FeltReportCell } from './cells';

export type BubbleProperties = { reports: number; mmiReports: number };
export type BubbleFeature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: BubbleProperties;
};
export type BubbleCollection = { type: 'FeatureCollection'; features: BubbleFeature[] };

export const BUBBLE_CLUSTER_PROPERTIES: Record<keyof BubbleProperties, ExpressionSpecification> = {
  reports: ['+', ['get', 'reports']],
  mmiReports: ['+', ['get', 'mmiReports']],
};

export const MIN_BUBBLE_RADIUS_PX = 5;
const BUBBLE_RADIUS_PER_SQRT_REPORT_PX = 1.6;
export const MAX_BUBBLE_RADIUS_PX = 34;
export const SETTLED_BUBBLE_OPACITY = 0.85;
const WHITE = 'rgb(255, 255, 255)';
const INK = '#0b0d10';
const LIGHT_TEXT_FROM_MMI = 8.5;

const REPORTS: ExpressionSpecification = ['get', 'reports'];
const BUBBLE_MMI: ExpressionSpecification = ['/', ['get', 'mmiReports'], REPORTS];

export function getBubbleFeatures(cells: readonly FeltReportCell[]): BubbleCollection {
  return {
    type: 'FeatureCollection',
    features: cells.map((cell) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [cell.longitude, cell.latitude] },
      properties: {
        reports: cell.count,
        mmiReports: cell.mmi * cell.count,
      },
    })),
  };
}

export function getBubbleRadius(reports: number): number {
  return Math.min(
    MAX_BUBBLE_RADIUS_PX,
    MIN_BUBBLE_RADIUS_PX + BUBBLE_RADIUS_PER_SQRT_REPORT_PX * Math.sqrt(Math.max(0, reports)),
  );
}

function getPaletteStops({ colors, extent: [low, high] }: ShakemapPalette): Array<number | string> {
  const step = (high - low) / (colors.length - 1);
  return colors.flatMap((color, index) => [low + step * index, color]);
}

export function getSettledBubbleRadiusExpression(): ExpressionSpecification {
  return [
    'min',
    MAX_BUBBLE_RADIUS_PX,
    ['+', MIN_BUBBLE_RADIUS_PX, ['*', BUBBLE_RADIUS_PER_SQRT_REPORT_PX, ['sqrt', REPORTS]]],
  ];
}

export function getSettledBubbleColorExpression(palette: ShakemapPalette): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    BUBBLE_MMI,
    ...getPaletteStops(palette),
  ] as ExpressionSpecification;
}

export function getBubbleTextColorExpression(): ExpressionSpecification {
  return ['case', ['>=', BUBBLE_MMI, LIGHT_TEXT_FROM_MMI], WHITE, INK];
}
