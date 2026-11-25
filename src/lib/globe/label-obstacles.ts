import { type LabelBox, LABEL_OBSTACLE_SELECTOR } from './country-labels';

export const LABEL_OBSTACLE_ICON_ID = 'qw-label-obstacle';
export const LABEL_OBSTACLE_ICON_PX = 16;

export type ObstacleSquare = { x: number; y: number; size: number };
export type ObstacleFeatureCollection = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: { iconSize: number };
  }>;
};

export function getLabelObstacleBoxes(host: HTMLElement): LabelBox[] {
  const origin = host.getBoundingClientRect();
  return [...document.querySelectorAll(LABEL_OBSTACLE_SELECTOR)]
    .filter((obstacle) => obstacle.checkVisibility({ visibilityProperty: true }))
    .map((obstacle) => obstacle.getBoundingClientRect())
    .filter(({ width, height }) => width > 0 && height > 0)
    .map(({ left, top, right, bottom }) => ({
      left: left - origin.left,
      top: top - origin.top,
      right: right - origin.left,
      bottom: bottom - origin.top,
    }));
}

function getSpreadCentres(start: number, length: number, size: number): number[] {
  const count = Math.ceil(length / size);
  if (count <= 1) return [start + length / 2];
  const step = (length - size) / (count - 1);
  return Array.from({ length: count }, (_, index) => start + size / 2 + index * step);
}

export function getObstacleSquares({ left, top, right, bottom }: LabelBox): ObstacleSquare[] {
  const width = right - left;
  const height = bottom - top;
  const size = Math.min(width, height);
  return getSpreadCentres(top, height, size).flatMap((y) =>
    getSpreadCentres(left, width, size).map((x) => ({ x, y, size })),
  );
}

export function getObstacleFeatures(
  boxes: readonly LabelBox[],
  unproject: (x: number, y: number) => [number, number],
): ObstacleFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: boxes.flatMap(getObstacleSquares).map(({ x, y, size }) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: unproject(x, y) },
      properties: { iconSize: size / LABEL_OBSTACLE_ICON_PX },
    })),
  };
}
