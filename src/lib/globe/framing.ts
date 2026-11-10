export const FRAME_WINDOW_DEG = 60;
export const FRAME_STEP_DEG = 5;
const PREFERRED_CENTRE_DEG = 150;
const CENTRE_COUNT = 360 / FRAME_STEP_DEG;

function getWrappedDistance(a: number, b: number): number {
  return Math.abs(((((a - b) % 360) + 540) % 360) - 180);
}

function getNormalisedLongitude(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

function getCentre(index: number): number {
  return -180 + index * FRAME_STEP_DEG;
}

function getWindowCount(longitudes: readonly number[], centre: number): number {
  const halfWindow = FRAME_WINDOW_DEG / 2;
  return longitudes.filter((lon) => getWrappedDistance(lon, centre) <= halfWindow).length;
}

function getRunMiddles(isDensest: readonly boolean[]): number[] {
  const middles: number[] = [];
  isDensest.forEach((densest, start) => {
    if (!densest || isDensest[(start + CENTRE_COUNT - 1) % CENTRE_COUNT]) return;
    let length = 1;
    while (isDensest[(start + length) % CENTRE_COUNT]) length++;
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

export function getDensestLongitude(longitudes: readonly number[]): number | undefined {
  if (longitudes.length === 0) return undefined;
  const counts = Array.from({ length: CENTRE_COUNT }, (_, index) =>
    getWindowCount(longitudes, getCentre(index)),
  );
  const maxCount = Math.max(...counts);
  const isDensest = counts.map((count) => count === maxCount);
  if (isDensest.every(Boolean)) return PREFERRED_CENTRE_DEG;
  return getRunMiddles(isDensest).reduce((best, middle) =>
    isCloserToPreferred(middle, best) ? middle : best,
  );
}
