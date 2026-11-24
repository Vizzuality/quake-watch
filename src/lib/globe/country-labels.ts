import type { CountryLabel } from './country-labels.data';
import type { GlobeView } from './motion';
import type { GlobeFrame } from './picking';
import { getLatLonVector, getRotatedVector } from './sphere';

export const LABEL_FADE_DEGREES = 15;
export const LABEL_PADDING_PX = 4;
export const LABEL_OBSTACLE_SELECTOR = '[data-label-obstacle]';

export type LabelSize = { width: number; height: number };
export type LabelBox = { left: number; top: number; right: number; bottom: number };
export type PlacedLabel = { index: number; x: number; y: number; opacity: number };

const DEGREES_PER_RADIAN = 180 / Math.PI;
const FADE_START_DEGREES = 90 - LABEL_FADE_DEGREES;
const FADE_START_DEPTH = Math.cos(FADE_START_DEGREES / DEGREES_PER_RADIAN);

export function getLabelOpacity(depth: number): number {
  if (depth >= FADE_START_DEPTH) return 1;
  if (depth <= 0) return 0;
  return (90 - Math.acos(depth) * DEGREES_PER_RADIAN) / LABEL_FADE_DEGREES;
}

export function isLabelRankShown(rank: number, zoom: number): boolean {
  return rank <= zoom + 2;
}

function isBoxClear(
  boxes: readonly number[],
  left: number,
  top: number,
  right: number,
  bottom: number,
): boolean {
  for (let i = 0; i < boxes.length; i += 4) {
    if (left < boxes[i + 2] && right > boxes[i] && top < boxes[i + 3] && bottom > boxes[i + 1]) {
      return false;
    }
  }
  return true;
}

export function getPlacedLabels(
  labels: readonly Pick<CountryLabel, 'lat' | 'lon' | 'rank'>[],
  sizes: readonly LabelSize[],
  view: GlobeView,
  frame: GlobeFrame,
  obstacles: readonly LabelBox[] = [],
): PlacedLabel[] {
  const scale = frame.radius * view.zoom;
  const placed: PlacedLabel[] = [];
  const boxes = obstacles.flatMap(({ left, top, right, bottom }) => [left, top, right, bottom]);
  labels.forEach((label, index) => {
    if (!isLabelRankShown(label.rank, view.zoom)) return;
    const [vx, vy, depth] = getRotatedVector(
      getLatLonVector(label.lat, label.lon),
      view.lon,
      view.lat,
    );
    const opacity = getLabelOpacity(depth);
    if (opacity === 0) return;
    const x = frame.cx + vx * scale;
    const y = frame.cy - vy * scale;
    const halfWidth = sizes[index].width / 2 + LABEL_PADDING_PX;
    const halfHeight = sizes[index].height / 2 + LABEL_PADDING_PX;
    const left = x - halfWidth;
    const top = y - halfHeight;
    const right = x + halfWidth;
    const bottom = y + halfHeight;
    if (!isBoxClear(boxes, left, top, right, bottom)) return;
    boxes.push(left, top, right, bottom);
    placed.push({ index, x, y, opacity });
  });
  return placed;
}
