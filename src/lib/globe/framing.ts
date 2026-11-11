import type { Earthquake } from '../earthquakes/types';

export const FRAME_WINDOW_DEG = 60;
export const FRAME_STEP_DEG = 5;
const PREFERRED_CENTRE_DEG = 150;
const CENTRE_COUNT = 360 / FRAME_STEP_DEG;
const TIE_TOLERANCE = 1e-9;

type FramedEarthquake = Pick<Earthquake, 'longitude' | 'magnitude'>;

function getWrappedDistance(a: number, b: number): number {
  return Math.abs(((((a - b) % 360) + 540) % 360) - 180);
}

function getNormalisedLongitude(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

function getCentre(index: number): number {
  return -180 + index * FRAME_STEP_DEG;
}

function getWindowWeight(earthquakes: readonly FramedEarthquake[], centre: number): number {
  const halfWindow = FRAME_WINDOW_DEG / 2;
  return earthquakes
    .filter(({ longitude }) => getWrappedDistance(longitude, centre) <= halfWindow)
    .reduce((sum, { magnitude }) => sum + 10 ** magnitude, 0);
}

function getRunMiddles(isTop: readonly boolean[]): number[] {
  const middles: number[] = [];
  isTop.forEach((top, start) => {
    if (!top || isTop[(start + CENTRE_COUNT - 1) % CENTRE_COUNT]) return;
    let length = 1;
    while (isTop[(start + length) % CENTRE_COUNT]) length++;
    middles.push(getNormalisedLongitude(getCentre(start + (length - 1) / 2)));
  });
  return middles;
}

function isCloserToPreferred(candidate: number, best: number): boolean {
  const candidateDistance = getWrappedDistance(candidate, PREFERRED_CENTRE_DEG);
  const bestDistance = getWrappedDistance(best, PREFERRED_CENTRE_DEG);
  if (candidateDistance === bestDistance) return candidate < best;
  return candidateDistance < bestDistance;
}

export function getFramedLongitude(earthquakes: readonly FramedEarthquake[]): number | undefined {
  if (earthquakes.length === 0) return undefined;
  const weights = Array.from({ length: CENTRE_COUNT }, (_, index) =>
    getWindowWeight(earthquakes, getCentre(index)),
  );
  const maxWeight = Math.max(...weights);
  const isTop = weights.map((weight) => maxWeight - weight <= maxWeight * TIE_TOLERANCE);
  if (isTop.every(Boolean)) return PREFERRED_CENTRE_DEG;
  return getRunMiddles(isTop).reduce((best, middle) =>
    isCloserToPreferred(middle, best) ? middle : best,
  );
}
