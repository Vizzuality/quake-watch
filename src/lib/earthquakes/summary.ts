import { getFeltReachKm } from './intensity';
import { getShownCount, getSortedByTime } from './timeline';
import type { Earthquake } from './types';

export type SummaryIndex = {
  sortedTimes: Float64Array;
  feltCounts: Uint32Array;
  largest: ReadonlyArray<Earthquake | null>;
};

export type SummaryStats = {
  count: number;
  feltCount: number;
  largest: Earthquake | null;
};

export function getSummaryIndex(earthquakes: readonly Earthquake[]): SummaryIndex {
  const sorted = getSortedByTime(earthquakes);
  const sortedTimes = new Float64Array(sorted.length);
  const feltCounts = new Uint32Array(sorted.length + 1);
  const largest: (Earthquake | null)[] = [null];
  sorted.forEach((earthquake, index) => {
    sortedTimes[index] = earthquake.time;
    const isFelt = getFeltReachKm(earthquake) > 0;
    feltCounts[index + 1] = feltCounts[index] + Number(isFelt);
    const previous = largest[index];
    largest.push(previous && previous.magnitude >= earthquake.magnitude ? previous : earthquake);
  });
  return { sortedTimes, feltCounts, largest };
}

export function getSummaryShownCount(index: SummaryIndex, playhead: number | null): number {
  return getShownCount(index.sortedTimes, playhead);
}

export function getSummaryStats(index: SummaryIndex, shownCount: number): SummaryStats {
  const count = Math.min(shownCount, index.sortedTimes.length);
  return { count, feltCount: index.feltCounts[count], largest: index.largest[count] };
}
