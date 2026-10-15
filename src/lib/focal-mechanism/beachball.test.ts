import { describe, expect, it } from 'vitest';

import { getBeachballCompressionalPath, getFaultType, getIsCompressional } from './beachball';
import type { NodalPlane } from './beachball';

type Point = readonly [number, number];

const STRIKE_SLIP: NodalPlane = { strikeDeg: 0, dipDeg: 90, rakeDeg: 0 };
const REVERSE: NodalPlane = { strikeDeg: 0, dipDeg: 45, rakeDeg: 90 };
const NORMAL: NodalPlane = { strikeDeg: 0, dipDeg: 45, rakeDeg: -90 };
const OBLIQUE: NodalPlane = { strikeDeg: 30, dipDeg: 60, rakeDeg: 45 };

const OBLIQUE_T_AXIS = [-0.4218, -0.1884] as const;
const OBLIQUE_P_AXIS = [0.4782, -0.8318] as const;

const RADIUS = 50;
const NEIGHBOUR_OFFSET = 0.03;

function getPolygons(path: string): Point[][] {
  return path
    .split('Z')
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => {
      const numbers = chunk
        .replaceAll(/[ML]/g, ' ')
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      const polygon: Point[] = [];
      for (let index = 0; index < numbers.length; index += 2) {
        polygon.push([numbers[index] / RADIUS - 1, 1 - numbers[index + 1] / RADIUS]);
      }
      return polygon;
    });
}

function getIsInsidePolygon(polygon: Point[], [x, y]: Point): boolean {
  let isInside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [xi, yi] = polygon[index];
    const [xj, yj] = polygon[previous];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      isInside = !isInside;
    }
  }
  return isInside;
}

function getPolygonArea(polygon: Point[]): number {
  let doubleArea = 0;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    doubleArea +=
      polygon[previous][0] * polygon[index][1] - polygon[index][0] * polygon[previous][1];
  }
  return Math.abs(doubleArea) / 2;
}

function getGridPoints(step: number): Point[] {
  const points: Point[] = [];
  for (let x = -1 + step / 2; x < 1; x += step) {
    for (let y = -1 + step / 2; y < 1; y += step) {
      if (Math.hypot(x, y) < 0.95) {
        points.push([x, y]);
      }
    }
  }
  return points;
}

function getIsAwayFromNodalLines(plane: NodalPlane, [x, y]: Point): boolean {
  const polarity = getIsCompressional(plane, x, y);
  return [
    [NEIGHBOUR_OFFSET, 0],
    [-NEIGHBOUR_OFFSET, 0],
    [0, NEIGHBOUR_OFFSET],
    [0, -NEIGHBOUR_OFFSET],
  ].every(([dx, dy]) => getIsCompressional(plane, x + dx, y + dy) === polarity);
}

function getPathMismatches(plane: NodalPlane): Point[] {
  const polygons = getPolygons(getBeachballCompressionalPath(plane, RADIUS));
  return getGridPoints(0.04)
    .filter((point) => getIsAwayFromNodalLines(plane, point))
    .filter((point) => {
      const isInsidePath = polygons.some((polygon) => getIsInsidePolygon(polygon, point));
      return isInsidePath !== getIsCompressional(plane, point[0], point[1]);
    });
}

function getCompressionalAreaRatio(plane: NodalPlane): number {
  const polygons = getPolygons(getBeachballCompressionalPath(plane, RADIUS));
  const area = polygons.reduce((sum, polygon) => sum + getPolygonArea(polygon), 0);
  return area / Math.PI;
}

function getPolarityGrid(plane: NodalPlane): boolean[] {
  return getGridPoints(0.1).map(([x, y]) => getIsCompressional(plane, x, y));
}

describe('getFaultType', () => {
  it.each([
    [0, 'strike-slip'],
    [30, 'strike-slip'],
    [-30, 'strike-slip'],
    [150, 'strike-slip'],
    [180, 'strike-slip'],
    [-180, 'strike-slip'],
    [-150, 'strike-slip'],
    [60, 'reverse'],
    [90, 'reverse'],
    [120, 'reverse'],
    [-60, 'normal'],
    [-90, 'normal'],
    [-120, 'normal'],
    [45, 'oblique-reverse'],
    [135, 'oblique-reverse'],
    [-45, 'oblique-normal'],
    [-135, 'oblique-normal'],
  ] as const)('classifies rake %d as %s', (rakeDeg, faultType) => {
    expect(getFaultType({ strikeDeg: 0, dipDeg: 45, rakeDeg })).toBe(faultType);
  });

  it('normalises rake outside (-180, 180]', () => {
    expect(getFaultType({ strikeDeg: 0, dipDeg: 45, rakeDeg: 270 })).toBe('normal');
    expect(getFaultType({ strikeDeg: 0, dipDeg: 45, rakeDeg: -270 })).toBe('reverse');
    expect(getFaultType({ strikeDeg: 0, dipDeg: 45, rakeDeg: 190 })).toBe('strike-slip');
    expect(getFaultType({ strikeDeg: 0, dipDeg: 45, rakeDeg: 405 })).toBe('oblique-reverse');
  });
});

describe('getIsCompressional', () => {
  it('puts compression in the NE and SW quadrants of a left-lateral N-S strike-slip', () => {
    expect(getIsCompressional(STRIKE_SLIP, 0.5, 0.5)).toBe(true);
    expect(getIsCompressional(STRIKE_SLIP, -0.5, -0.5)).toBe(true);
    expect(getIsCompressional(STRIKE_SLIP, -0.5, 0.5)).toBe(false);
    expect(getIsCompressional(STRIKE_SLIP, 0.5, -0.5)).toBe(false);
  });

  it('makes the centre compressional for a reverse fault and dilatational on its sides', () => {
    expect(getIsCompressional(REVERSE, 0, 0)).toBe(true);
    expect(getIsCompressional(REVERSE, 0.9, 0)).toBe(false);
    expect(getIsCompressional(REVERSE, -0.9, 0)).toBe(false);
  });

  it('makes the centre dilatational for a normal fault and compressional on its sides', () => {
    expect(getIsCompressional(NORMAL, 0, 0)).toBe(false);
    expect(getIsCompressional(NORMAL, 0.9, 0)).toBe(true);
    expect(getIsCompressional(NORMAL, -0.9, 0)).toBe(true);
  });

  it('places the T axis in compression and the P axis in dilatation for an oblique fault', () => {
    expect(getIsCompressional(OBLIQUE, ...OBLIQUE_T_AXIS)).toBe(true);
    expect(getIsCompressional(OBLIQUE, ...OBLIQUE_P_AXIS)).toBe(false);
  });

  it('treats strike 360 as strike 0', () => {
    expect(getPolarityGrid({ ...OBLIQUE, strikeDeg: 390 })).toEqual(getPolarityGrid(OBLIQUE));
    expect(getPolarityGrid({ ...STRIKE_SLIP, strikeDeg: 360 })).toEqual(
      getPolarityGrid(STRIKE_SLIP),
    );
  });

  it('treats rake 180 as rake -180', () => {
    const plane = { strikeDeg: 20, dipDeg: 70, rakeDeg: 180 };
    expect(getPolarityGrid({ ...plane, rakeDeg: -180 })).toEqual(getPolarityGrid(plane));
  });

  it('splits a horizontal plane along the slip direction', () => {
    const plane = { strikeDeg: 0, dipDeg: 0, rakeDeg: 90 };
    expect(getIsCompressional(plane, 0.5, 0)).toBe(true);
    expect(getIsCompressional(plane, -0.5, 0)).toBe(false);
  });

  it('matches the USGS W-phase solution of the 2011 Tohoku megathrust', () => {
    const tohoku = { strikeDeg: 193, dipDeg: 14, rakeDeg: 81 };
    expect(getIsCompressional(tohoku, 0, 0)).toBe(true);
    expect(getIsCompressional(tohoku, 0.2, 0)).toBe(false);
    expect(getIsCompressional(tohoku, -0.9, 0)).toBe(false);
  });

  it("matches the normal-faulting solution of the 2009 L'Aquila earthquake", () => {
    expect(getIsCompressional({ strikeDeg: 147, dipDeg: 43, rakeDeg: -88 }, 0, 0)).toBe(false);
  });
});

describe('getBeachballCompressionalPath', () => {
  it('returns a non-empty path that starts with a move command', () => {
    const path = getBeachballCompressionalPath(OBLIQUE, RADIUS);
    expect(path.length).toBeGreaterThan(0);
    expect(path.startsWith('M')).toBe(true);
  });

  it('keeps every vertex inside the ball', () => {
    const polygons = getPolygons(getBeachballCompressionalPath(OBLIQUE, RADIUS));
    for (const [x, y] of polygons.flat()) {
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(1 + 0.01 / RADIUS);
    }
  });

  it.each([
    ['strike-slip (0, 90, 0)', STRIKE_SLIP],
    ['reverse (0, 45, 90)', REVERSE],
    ['normal (0, 45, -90)', NORMAL],
    ['oblique (30, 60, 45)', OBLIQUE],
    ['near-dip-slip (120, 30, 89)', { strikeDeg: 120, dipDeg: 30, rakeDeg: 89 }],
    ['vertical dip-slip (45, 90, 90)', { strikeDeg: 45, dipDeg: 90, rakeDeg: 90 }],
    ['horizontal plane (0, 0, 90)', { strikeDeg: 0, dipDeg: 0, rakeDeg: 90 }],
    ['near-horizontal plane (200, 0.01, -30)', { strikeDeg: 200, dipDeg: 0.01, rakeDeg: -30 }],
    ['strike 360 (360, 70, -160)', { strikeDeg: 360, dipDeg: 70, rakeDeg: -160 }],
    ['rake 180 (10, 80, 180)', { strikeDeg: 10, dipDeg: 80, rakeDeg: 180 }],
    ['rake -180 (10, 80, -180)', { strikeDeg: 10, dipDeg: 80, rakeDeg: -180 }],
  ])('agrees with the polarity oracle for %s', (_label, plane) => {
    expect(getPathMismatches(plane)).toEqual([]);
  });

  it.each([STRIKE_SLIP, REVERSE, NORMAL, OBLIQUE, { strikeDeg: 0, dipDeg: 0, rakeDeg: 0 }])(
    'fills half of the equal-area disc for %o',
    (plane) => {
      expect(getCompressionalAreaRatio(plane)).toBeCloseTo(0.5, 2);
    },
  );
});
