import { getRadians } from '@/lib/earthquakes/distance';

import type { FeltReport } from './csv';

export type FeltReportCell = { longitude: number; latitude: number; mmi: number; count: number };

const KM_PER_DEGREE_LATITUDE = 111.32;
const MAX_VALID_RAW_INTENSITY = 11;
const CORRECTION_THRESHOLD = 2.5;
const MIN_COS_LATITUDE = 0.01;

type CellSum = {
  origin: number;
  offset: number;
  latitude: number;
  intensity: number;
  count: number;
};

const FULL_TURN_DEG = 360;
const HALF_TURN_DEG = 180;

function getWrappedLongitude(longitude: number): number {
  return (
    ((((longitude + HALF_TURN_DEG) % FULL_TURN_DEG) + FULL_TURN_DEG) % FULL_TURN_DEG) -
    HALF_TURN_DEG
  );
}

function getLongitudeOffset(longitude: number, origin: number): number {
  const offset = longitude - origin;
  return offset - FULL_TURN_DEG * Math.round(offset / FULL_TURN_DEG);
}

export function getCorrectedIntensity(intensity: number): number {
  return intensity >= CORRECTION_THRESHOLD ? 1.3 * intensity - 0.75 : intensity;
}

export function getFeltReportCells(reports: readonly FeltReport[], cellKm = 10): FeltReportCell[] {
  const latitudeStep = cellKm / KM_PER_DEGREE_LATITUDE;
  const sums = new Map<string, CellSum>();
  for (const { longitude, latitude, rawIntensity } of reports) {
    if (rawIntensity >= MAX_VALID_RAW_INTENSITY) continue;
    const row = Math.floor(latitude / latitudeStep);
    const rowLatitude = (row + 0.5) * latitudeStep;
    const longitudeStep =
      latitudeStep / Math.max(MIN_COS_LATITUDE, Math.cos(getRadians(rowLatitude)));
    const key = `${row}:${Math.floor(longitude / longitudeStep)}`;
    const sum = sums.get(key) ?? {
      origin: longitude,
      offset: 0,
      latitude: 0,
      intensity: 0,
      count: 0,
    };
    sum.offset += getLongitudeOffset(longitude, sum.origin);
    sum.latitude += latitude;
    sum.intensity += rawIntensity;
    sum.count += 1;
    sums.set(key, sum);
  }
  return Array.from(sums.values(), ({ origin, offset, latitude, intensity, count }) => ({
    longitude: getWrappedLongitude(origin + offset / count),
    latitude: latitude / count,
    mmi: getCorrectedIntensity(intensity / count),
    count,
  }));
}
