export const DEPTH_COLOR_STOPS = [
  [0, 255, 154, 77],
  [70, 255, 94, 108],
  [300, 192, 79, 216],
  [700, 79, 123, 255],
] as const;

type DepthColorStop = (typeof DEPTH_COLOR_STOPS)[number];

function getRgb([, r, g, b]: readonly number[]): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function getClampedDepth(depthKm: number): number {
  const first = DEPTH_COLOR_STOPS[0][0];
  const last = DEPTH_COLOR_STOPS[DEPTH_COLOR_STOPS.length - 1][0];
  if (Number.isNaN(depthKm)) return first;
  return Math.min(Math.max(depthKm, first), last);
}

export function getDepthColor(depthKm: number): string {
  const depth = getClampedDepth(depthKm);
  const upperIndex = DEPTH_COLOR_STOPS.findIndex(([km]) => km >= depth);
  const upper: DepthColorStop = DEPTH_COLOR_STOPS[upperIndex];
  if (upperIndex === 0 || upper[0] === depth) return getRgb(upper);

  const lower: DepthColorStop = DEPTH_COLOR_STOPS[upperIndex - 1];
  const t = (depth - lower[0]) / (upper[0] - lower[0]);
  return getRgb(lower.map((value, i) => value + (upper[i] - value) * t));
}
