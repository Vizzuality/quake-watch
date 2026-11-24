import { getDistanceKm } from '../sequences';
import type { Earthquake } from '../types';

export const DUPLICATE_MAX_SECONDS = 16;
export const DUPLICATE_MAX_KM = 100;
export const DUPLICATE_MAX_MAGNITUDE_GAP = 0.5;

function getLowerBound(sorted: readonly Earthquake[], time: number): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (sorted[middle].time < time) low = middle + 1;
    else high = middle;
  }
  return low;
}

function getDuplicateScore(a: Earthquake, b: Earthquake): number | null {
  const seconds = Math.abs(a.time - b.time) / 1000;
  const km = getDistanceKm(a, b);
  const magnitudeGap = Math.abs(a.magnitude - b.magnitude);
  if (seconds > DUPLICATE_MAX_SECONDS || km > DUPLICATE_MAX_KM) return null;
  if (magnitudeGap > DUPLICATE_MAX_MAGNITUDE_GAP) return null;
  return seconds / DUPLICATE_MAX_SECONDS + km / DUPLICATE_MAX_KM;
}

function getDuplicateIndex(
  earthquake: Earthquake,
  sorted: readonly Earthquake[],
  taken: ReadonlySet<number>,
): number | null {
  const windowMs = DUPLICATE_MAX_SECONDS * 1000;
  let best: { index: number; score: number } | null = null;
  for (
    let index = getLowerBound(sorted, earthquake.time - windowMs);
    index < sorted.length;
    index++
  ) {
    if (sorted[index].time > earthquake.time + windowMs) break;
    if (taken.has(index)) continue;
    const score = getDuplicateScore(earthquake, sorted[index]);
    if (score !== null && (best === null || score < best.score)) best = { index, score };
  }
  return best?.index ?? null;
}

export function getMergedEarthquakes(
  emsc: readonly Earthquake[],
  usgs: readonly Earthquake[],
): Earthquake[] {
  const sortedEmsc = emsc.toSorted((a, b) => a.time - b.time);
  const duplicates = new Set<number>();
  for (const earthquake of usgs) {
    const index = getDuplicateIndex(earthquake, sortedEmsc, duplicates);
    if (index !== null) duplicates.add(index);
  }
  const unmatchedEmsc = sortedEmsc.filter((_, index) => !duplicates.has(index));
  return [...usgs, ...unmatchedEmsc].toSorted((a, b) => b.time - a.time);
}
