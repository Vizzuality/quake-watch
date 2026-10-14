import { getDistanceKm } from '@/lib/earthquakes/distance';
import type { SearchCenter } from '@/lib/earthquakes/search-schema';

import type { FeltReportCell } from './cells';

export type FeltReportsBounds = [number, number, number, number];

const VIEW_SHARE = 0.9;
const VIEW_PAD_KM = 7.5;
const FULL_TURN_DEG = 360;
const KM_PER_DEGREE = 111.32;
const MAX_LATITUDE = 85;
const MIN_COS_LATITUDE = 0.01;

type Extent = { low: number; high: number };

function getCosLatitude(latitude: number): number {
  return Math.max(MIN_COS_LATITUDE, Math.cos((latitude * Math.PI) / 180));
}

function getFramedLongitude(longitude: number, around: number): number {
  return longitude + FULL_TURN_DEG * Math.round((around - longitude) / FULL_TURN_DEG);
}

function getExtent(values: readonly number[]): Extent {
  return values.reduce(
    ({ low, high }, value) => ({ low: Math.min(low, value), high: Math.max(high, value) }),
    { low: Infinity, high: -Infinity },
  );
}

export function getFramedCells(
  cells: readonly FeltReportCell[],
  epicenter: SearchCenter,
): FeltReportCell[] {
  return cells.map((cell) => ({
    ...cell,
    longitude: getFramedLongitude(cell.longitude, epicenter.longitude),
  }));
}

export function getFeltReportsBounds(
  cells: readonly FeltReportCell[],
  epicenter: SearchCenter,
  padKm = 0,
): FeltReportsBounds {
  const framed = getFramedCells(cells, epicenter);
  const latitudes = getExtent([epicenter.latitude, ...framed.map(({ latitude }) => latitude)]);
  const longitudes = getExtent([epicenter.longitude, ...framed.map(({ longitude }) => longitude)]);
  const south = Math.max(-MAX_LATITUDE, latitudes.low - padKm / KM_PER_DEGREE);
  const north = Math.min(MAX_LATITUDE, latitudes.high + padKm / KM_PER_DEGREE);
  const padLongitude =
    padKm / (KM_PER_DEGREE * getCosLatitude(Math.max(Math.abs(south), Math.abs(north))));
  return [longitudes.low - padLongitude, south, longitudes.high + padLongitude, north];
}

export function getNearestCells(
  cells: readonly FeltReportCell[],
  epicenter: SearchCenter,
): FeltReportCell[] {
  return cells
    .toSorted((a, b) => getDistanceKm(epicenter, a) - getDistanceKm(epicenter, b))
    .slice(0, Math.max(1, Math.ceil(cells.length * VIEW_SHARE)));
}

export function getFeltReportsViewBounds(
  cells: readonly FeltReportCell[],
  epicenter: SearchCenter,
): FeltReportsBounds {
  return getFeltReportsBounds(getNearestCells(cells, epicenter), epicenter, VIEW_PAD_KM);
}
