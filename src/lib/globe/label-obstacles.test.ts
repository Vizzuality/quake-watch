import { describe, expect, it } from 'vitest';

import {
  LABEL_OBSTACLE_ICON_PX,
  LABEL_OBSTACLE_MAX_SQUARE_PX,
  getObstacleFeatures,
  getObstacleSquares,
} from './label-obstacles';

describe('getObstacleSquares', () => {
  it('covers a square obstacle with one square of its size', () => {
    expect(getObstacleSquares({ left: 10, top: 20, right: 50, bottom: 60 })).toEqual([
      { x: 30, y: 40, size: 40 },
    ]);
  });

  it('spreads squares of the short side along a wide obstacle, ending flush with both edges', () => {
    expect(getObstacleSquares({ left: 0, top: 0, right: 125, bottom: 50 })).toEqual([
      { x: 25, y: 25, size: 50 },
      { x: 62.5, y: 25, size: 50 },
      { x: 100, y: 25, size: 50 },
    ]);
  });

  it('tiles a large obstacle in both directions with squares no bigger than the cap', () => {
    const squares = getObstacleSquares({ left: 0, top: 0, right: 200, bottom: 100 });

    expect(new Set(squares.map(({ size }) => size))).toEqual(
      new Set([LABEL_OBSTACLE_MAX_SQUARE_PX]),
    );
    expect(new Set(squares.map(({ x }) => x)).size).toBe(4);
    expect(new Set(squares.map(({ y }) => y))).toEqual(new Set([32, 68]));
    expect(Math.min(...squares.map(({ x }) => x))).toBe(32);
    expect(Math.max(...squares.map(({ x }) => x))).toBe(168);
  });

  it('spreads squares down a tall obstacle', () => {
    expect(getObstacleSquares({ left: 100, top: 0, right: 140, bottom: 80 })).toEqual([
      { x: 120, y: 20, size: 40 },
      { x: 120, y: 60, size: 40 },
    ]);
  });
});

describe('getObstacleFeatures', () => {
  it('anchors one point per square where the camera puts it, sized in blocker icons', () => {
    const collection = getObstacleFeatures(
      [
        { left: 0, top: 0, right: 32, bottom: 32 },
        { left: 100, top: 0, right: 132, bottom: 64 },
      ],
      (x, y) => [x / 10, -y / 10],
    );

    expect(collection.features.map(({ geometry }) => geometry.coordinates)).toEqual([
      [1.6, -1.6],
      [11.6, -1.6],
      [11.6, -4.8],
    ]);
    expect(collection.features.map(({ properties }) => properties.iconSize)).toEqual([
      32 / LABEL_OBSTACLE_ICON_PX,
      32 / LABEL_OBSTACLE_ICON_PX,
      32 / LABEL_OBSTACLE_ICON_PX,
    ]);
  });

  it('is empty without obstacles', () => {
    expect(getObstacleFeatures([], () => [0, 0]).features).toEqual([]);
  });
});
