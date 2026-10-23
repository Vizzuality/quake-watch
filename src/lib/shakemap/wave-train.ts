import { getRadians } from '@/lib/earthquakes/distance';
import { FELT_INTENSITY, getFeltReachKm, getIntensity } from '@/lib/earthquakes/intensity';
import type { SearchCenter } from '@/lib/earthquakes/search-schema';
import { getCirclePosition } from '@/lib/map/search-area';
import { getRgb } from '@/lib/map/shaking-waves';
import type { Rgb } from '@/lib/map/shaking-waves';

import type { ShakemapContour } from './contours';

export const TRAIN_BEARINGS = 180;
export const TRAIN_CROSS_MS = 6_000;
export const TRAIN_INTERVAL_MS = 2_000;

export type IsoseismalProfile = {
  mmi: number;
  color: string;
  radiiKm: Float64Array;
  meanRadiusKm: number;
};
export type WaveTrainShape =
  | { kind: 'isoseismal'; profiles: readonly IsoseismalProfile[] }
  | {
      kind: 'circle';
      reachKm: number;
      magnitude: number;
      depthKm: number;
      observed: boolean;
    };
export type TrainFront = {
  type: 'Feature';
  properties: { color: string | null; opacity: number };
  geometry: { type: 'LineString'; coordinates: [number, number][] };
};
export type TrainFronts = { type: 'FeatureCollection'; features: TrainFront[] };
export type TrainBounds = [number, number, number, number];

type Point = readonly [number, number];
type Position = [number, number];
type FrontStage = { radiiKm: Float64Array; color: Rgb; position: number };

const KM_PER_DEGREE_LONGITUDE = 111.32;
const KM_PER_DEGREE_LATITUDE = 110.574;
const FULL_TURN = 2 * Math.PI;
const BIN_RADIANS = FULL_TURN / TRAIN_BEARINGS;
const FADE_SHARE = 0.15;
const OUTER_OPACITY = 0.35;
const MIN_CIRCLE_OPACITY = 0.15;
const MEDIAN_WINDOW_BINS = 5;
const MEAN_WINDOW_BINS = 3;
const OBSERVED_OPACITY_DROP = 0.85;

function getBinIndex(bin: number): number {
  return ((bin % TRAIN_BEARINGS) + TRAIN_BEARINGS) % TRAIN_BEARINGS;
}

function getWrappedDegrees(degrees: number): number {
  return ((((degrees + 180) % 360) + 360) % 360) - 180;
}

function getSignedTurn(from: number, to: number): number {
  return ((((to - from + Math.PI) % FULL_TURN) + FULL_TURN) % FULL_TURN) - Math.PI;
}

function getKmPerDegreeLongitude(epicenter: SearchCenter): number {
  return Math.cos(getRadians(epicenter.latitude)) * KM_PER_DEGREE_LONGITUDE;
}

function getPlanePoint(epicenter: SearchCenter, [longitude, latitude]: Point): Point {
  return [
    getWrappedDegrees(longitude - epicenter.longitude) * getKmPerDegreeLongitude(epicenter),
    (latitude - epicenter.latitude) * KM_PER_DEGREE_LATITUDE,
  ];
}

function getCross(first: Point, second: Point): number {
  return first[0] * second[1] - first[1] * second[0];
}

function addSegmentHits(radiiKm: Float64Array, start: Point, end: Point): void {
  const direction: Point = [end[0] - start[0], end[1] - start[1]];
  const startAngle = Math.atan2(start[1], start[0]);
  const endAngle = startAngle + getSignedTurn(startAngle, Math.atan2(end[1], end[0]));
  const firstBin = Math.ceil(Math.min(startAngle, endAngle) / BIN_RADIANS);
  const lastBin = Math.floor(Math.max(startAngle, endAngle) / BIN_RADIANS);
  for (let bin = firstBin; bin <= lastBin; bin += 1) {
    const angle = bin * BIN_RADIANS;
    const denominator = getCross([Math.cos(angle), Math.sin(angle)], direction);
    if (denominator === 0) continue;
    const index = getBinIndex(bin);
    radiiKm[index] = Math.max(radiiKm[index], getCross(start, direction) / denominator);
  }
}

function getFilledRadii(hitRadiiKm: Float64Array): Float64Array | null {
  const hits = Array.from(hitRadiiKm.keys()).filter((bin) => Number.isFinite(hitRadiiKm[bin]));
  if (hits.length === 0) return null;
  const radiiKm = Float64Array.from(hitRadiiKm);
  hits.forEach((hit, order) => {
    const next = hits[(order + 1) % hits.length];
    const gap = getBinIndex(next - hit) || TRAIN_BEARINGS;
    for (let step = 1; step < gap; step += 1) {
      radiiKm[getBinIndex(hit + step)] =
        hitRadiiKm[hit] + ((hitRadiiKm[next] - hitRadiiKm[hit]) * step) / gap;
    }
  });
  return radiiKm;
}

function getContourRadii(contour: ShakemapContour, epicenter: SearchCenter): Float64Array | null {
  const radiiKm = new Float64Array(TRAIN_BEARINGS).fill(Number.NEGATIVE_INFINITY);
  for (const line of contour.lines) {
    const points = line.map((position) => getPlanePoint(epicenter, position));
    for (let index = 1; index < points.length; index += 1) {
      addSegmentHits(radiiKm, points[index - 1], points[index]);
    }
  }
  return getFilledRadii(radiiKm);
}

function getContoursByMmi(contours: readonly ShakemapContour[]): ShakemapContour[] {
  const groups = new Map<number, ShakemapContour>();
  for (const { mmi, color, lines } of contours) {
    const group = groups.get(mmi);
    if (group) group.lines.push(...lines);
    else groups.set(mmi, { mmi, color, lines: [...lines] });
  }
  return [...groups.values()];
}

function getMean(values: Float64Array): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getMedian(values: Float64Array): number {
  return values.toSorted()[Math.floor(values.length / 2)];
}

function getWindowedRadii(
  radiiKm: Float64Array,
  size: number,
  getValue: (window: Float64Array) => number,
): Float64Array {
  const half = Math.floor(size / 2);
  return radiiKm.map((_, bin) =>
    getValue(
      Float64Array.from({ length: size }, (_, offset) => radiiKm[getBinIndex(bin + offset - half)]),
    ),
  );
}

function getSmoothedRadii(radiiKm: Float64Array): Float64Array {
  return getWindowedRadii(
    getWindowedRadii(radiiKm, MEDIAN_WINDOW_BINS, getMedian),
    MEAN_WINDOW_BINS,
    getMean,
  );
}

export function getIsoseismalProfiles(
  contours: readonly ShakemapContour[],
  epicenter: SearchCenter,
): IsoseismalProfile[] {
  const profiles: IsoseismalProfile[] = [];
  const sorted = getContoursByMmi(contours).toSorted((first, second) => second.mmi - first.mmi);
  for (const contour of sorted) {
    const contourRadiiKm = getContourRadii(contour, epicenter);
    if (!contourRadiiKm) continue;
    const radiiKm = getSmoothedRadii(contourRadiiKm);
    const previous = profiles.at(-1);
    if (previous) {
      radiiKm.forEach((radius, bin) => {
        radiiKm[bin] = Math.max(radius, previous.radiiKm[bin]);
      });
    }
    profiles.push({
      mmi: contour.mmi,
      color: contour.color,
      radiiKm,
      meanRadiusKm: getMean(radiiKm),
    });
  }
  return profiles;
}

export function getWaveTrainShape(
  contours: readonly ShakemapContour[] | null,
  earthquake: { latitude: number; longitude: number; magnitude: number; depthKm: number },
  observedReachKm = 0,
): WaveTrainShape {
  const profiles = getIsoseismalProfiles(contours ?? [], earthquake);
  if ((profiles.at(-1)?.meanRadiusKm ?? 0) > 0) return { kind: 'isoseismal', profiles };
  const { magnitude, depthKm } = earthquake;
  if (observedReachKm > 0) {
    return { kind: 'circle', reachKm: observedReachKm, magnitude, depthKm, observed: true };
  }
  const reachKm = getFeltReachKm({ magnitude, depthKm });
  return { kind: 'circle', reachKm, magnitude, depthKm, observed: false };
}

export function getTrainReachKm(shape: WaveTrainShape): number {
  if (shape.kind === 'circle') return shape.reachKm;
  return shape.profiles.at(-1)?.meanRadiusKm ?? 0;
}

function getCircleRing(epicenter: SearchCenter, radiusKm: number): Position[] {
  return Array.from({ length: TRAIN_BEARINGS + 1 }, (_, index) =>
    getCirclePosition(epicenter, radiusKm, (index % TRAIN_BEARINGS) * BIN_RADIANS),
  );
}

function getIsoseismalRing(epicenter: SearchCenter, radiiKm: Float64Array): Position[] {
  const kmPerDegreeLongitude = getKmPerDegreeLongitude(epicenter);
  return Array.from({ length: TRAIN_BEARINGS + 1 }, (_, index) => {
    const bin = index % TRAIN_BEARINGS;
    const angle = bin * BIN_RADIANS;
    return [
      epicenter.longitude + (radiiKm[bin] * Math.cos(angle)) / kmPerDegreeLongitude,
      epicenter.latitude + (radiiKm[bin] * Math.sin(angle)) / KM_PER_DEGREE_LATITUDE,
    ];
  });
}

function getCssColor([red, green, blue]: Rgb): string {
  return `rgb(${Math.round(red * 255)}, ${Math.round(green * 255)}, ${Math.round(blue * 255)})`;
}

function getFrontStage(profiles: readonly IsoseismalProfile[], distanceKm: number): FrontStage {
  const lowerIndex = profiles.findLastIndex(({ meanRadiusKm }) => meanRadiusKm <= distanceKm);
  if (lowerIndex === -1) {
    const [inner] = profiles;
    const scale = distanceKm / inner.meanRadiusKm;
    return {
      radiiKm: inner.radiiKm.map((radius) => radius * scale),
      color: getRgb(inner.color),
      position: 0,
    };
  }
  const lower = profiles[lowerIndex];
  const next = profiles[lowerIndex + 1];
  if (!next) return { radiiKm: lower.radiiKm, color: getRgb(lower.color), position: lowerIndex };
  const weight = (distanceKm - lower.meanRadiusKm) / (next.meanRadiusKm - lower.meanRadiusKm);
  const from = getRgb(lower.color);
  const to = getRgb(next.color);
  return {
    radiiKm: lower.radiiKm.map((radius, bin) => radius + (next.radiiKm[bin] - radius) * weight),
    color: [
      from[0] + (to[0] - from[0]) * weight,
      from[1] + (to[1] - from[1]) * weight,
      from[2] + (to[2] - from[2]) * weight,
    ],
    position: lowerIndex + weight,
  };
}

function getFade(progress: number): number {
  return Math.min(1, (1 - progress) / FADE_SHARE);
}

function getFront(coordinates: Position[], color: string | null, opacity: number): TrainFront {
  return {
    type: 'Feature',
    properties: { color, opacity },
    geometry: { type: 'LineString', coordinates },
  };
}

function getIsoseismalFront(
  profiles: readonly IsoseismalProfile[],
  epicenter: SearchCenter,
  distanceKm: number,
  fade: number,
): TrainFront {
  const { radiiKm, color, position } = getFrontStage(profiles, distanceKm);
  const dimming = ((1 - OUTER_OPACITY) * position) / Math.max(1, profiles.length - 1);
  return getFront(getIsoseismalRing(epicenter, radiiKm), getCssColor(color), (1 - dimming) * fade);
}

type CircleShape = Extract<WaveTrainShape, { kind: 'circle' }>;

function getCircleShare(
  { magnitude, depthKm, reachKm, observed }: CircleShape,
  distanceKm: number,
): number {
  if (observed) return 1 - (OBSERVED_OPACITY_DROP * distanceKm) / reachKm;
  const range = getIntensity({ magnitude, depthKm, distanceKm: 0 }) - FELT_INTENSITY;
  return (
    (getIntensity({ magnitude, depthKm, distanceKm }) - FELT_INTENSITY) /
    Math.max(range, Number.EPSILON)
  );
}

function getCircleOpacity(shape: CircleShape, distanceKm: number): number {
  return Math.min(1, Math.max(MIN_CIRCLE_OPACITY, getCircleShare(shape, distanceKm)));
}

function getEmissionAgesMs(elapsedMs: number): number[] {
  const youngest = ((elapsedMs % TRAIN_INTERVAL_MS) + TRAIN_INTERVAL_MS) % TRAIN_INTERVAL_MS;
  const count = Math.ceil((TRAIN_CROSS_MS - youngest) / TRAIN_INTERVAL_MS);
  return Array.from({ length: count }, (_, index) => youngest + index * TRAIN_INTERVAL_MS).filter(
    (age) => age > 0,
  );
}

export function getTrainFronts(
  shape: WaveTrainShape,
  epicenter: SearchCenter,
  elapsedMs: number,
): TrainFronts {
  const reachKm = getTrainReachKm(shape);
  if (reachKm <= 0) return { type: 'FeatureCollection', features: [] };
  const features = getEmissionAgesMs(elapsedMs).map((age) => {
    const progress = age / TRAIN_CROSS_MS;
    const distanceKm = progress * reachKm;
    if (shape.kind === 'isoseismal') {
      return getIsoseismalFront(shape.profiles, epicenter, distanceKm, getFade(progress));
    }
    const opacity = getCircleOpacity(shape, distanceKm);
    return getFront(getCircleRing(epicenter, distanceKm), null, opacity * getFade(progress));
  });
  return { type: 'FeatureCollection', features };
}

function getRingBounds(ring: readonly Position[]): TrainBounds {
  const longitudes = ring.map(([longitude]) => longitude);
  const latitudes = ring.map(([, latitude]) => latitude);
  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ];
}

export function getTrainBounds(shape: WaveTrainShape, epicenter: SearchCenter): TrainBounds | null {
  if (shape.kind === 'circle') {
    if (shape.reachKm <= 0) return null;
    return getRingBounds(getCircleRing(epicenter, shape.reachKm));
  }
  const outer = shape.profiles.at(-1);
  if (!outer || outer.meanRadiusKm <= 0) return null;
  return getRingBounds(getIsoseismalRing(epicenter, outer.radiiKm));
}

export function getMergedBounds(first: TrainBounds, second: TrainBounds): TrainBounds {
  return [
    Math.min(first[0], second[0]),
    Math.min(first[1], second[1]),
    Math.max(first[2], second[2]),
    Math.max(first[3], second[3]),
  ];
}
