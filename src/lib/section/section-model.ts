import type { Earthquake } from '@/lib/earthquakes/types';
import type { LngLat } from '@/lib/globe/map-felt-rings';

import type { CrustColumn } from './crust-layers';
import { type DepthScale, SECTION_FRAME, getDepthScale } from './depth-scale';
import { SLICE_LOOK, getSliceAlongKm, getSliceLines, getSliceOffset } from './slice-line';

export type Point = [number, number];
export type LayerId = 'water' | 'sediments' | 'upper' | 'middle' | 'lower' | 'mantle';

export type SectionInput = {
  earthquake: Earthquake;
  elevationsM: readonly ArrayLike<number>[];
  getCrust: (lon: number, lat: number) => CrustColumn;
  getSlabDepthKm: (lon: number, lat: number) => number | null;
  others: readonly Earthquake[];
};

export type Band = { id: LayerId; polygon: string; top: string };
export type Face = {
  clip: string;
  bands: Band[];
  surface: string;
  seaLevel: string;
  grid: string[];
};
export type BackLine = {
  index: number;
  polygon: string;
  line: string;
  land: string[];
  opacity: number;
  landOpacity: number;
};
export type SlabLine = { runs: string[]; opacity: number };
export type SlabLabel = { x: number; y: number; anchor: 'start' | 'end' };
export type Slab = {
  front: string[];
  echoes: SlabLine[];
  back: SlabLine[];
  label: SlabLabel;
  depthAtEpicentreKm: number | null;
};
export type OtherMark = { id: string; x: number; topY: number; y: number; radius: number };
export type SectionFacts = {
  layer: LayerId;
  surfaceElevationM: number;
  crustThicknessKm: number;
  slabDepthKm: number | null;
};
export type SectionModel = {
  scale: DepthScale;
  backLines: BackLine[];
  front: Face;
  east: Face;
  slab: Slab | null;
  hypocentre: { x: number; y: number; surfaceY: number };
  others: OtherMark[];
  facts: SectionFacts;
};

type Column = { x: number; shiftY: number; surfaceKm: number; crust: CrustColumn };

export const SECTION_LOOK = {
  backStepX: 1.8,
  backStepY: -1.65,
  backOpacityNear: 0.285,
  backOpacityFar: 0.09,
  landOpacityNear: 0.9,
  landOpacityFar: 0.6,
  echoGapPx: 6.7,
  echoOpacities: [0.55, 0.32, 0.16, 0.07],
  slabBackEvery: 5,
  slabBackOpacityNear: 0.39,
  slabBackOpacityStep: 0.024,
  slabLabelOffset: { x: 22, y: -17.7 },
  slabLabelBottomGap: 20,
  corridorKm: 100,
} as const;

const LAYER_IDS: readonly LayerId[] = ['sediments', 'upper', 'middle', 'lower', 'mantle'];

function getRounded(value: number): number {
  return Math.round(value * 10) / 10;
}

export function getPointsAttribute(points: readonly Point[]): string {
  return points.map(([x, y]) => `${getRounded(x)},${getRounded(y)}`).join(' ');
}

function getPolygon(top: readonly Point[], bottom: readonly Point[]): string {
  return getPointsAttribute([...top, ...bottom.toReversed()]);
}

function getBoundariesKm({ surfaceKm, crust }: Column): number[] {
  const { sedimentsKm, upperKm, middleKm, lowerKm } = crust;
  return [sedimentsKm, upperKm, middleKm, lowerKm].reduce(
    (boundaries, thicknessKm) => [...boundaries, (boundaries.at(-1) ?? 0) + thicknessKm],
    [surfaceKm],
  );
}

function getFace(columns: readonly Column[], scale: DepthScale): Face {
  const getPoints = (getDepthKm: (column: Column) => number) =>
    columns.map((column): Point => [column.x, scale.getY(getDepthKm(column)) + column.shiftY]);
  const topOfGround = getPoints((column) => Math.min(0, column.surfaceKm));
  const bottom = getPoints(() => scale.bottomDepthKm);
  const boundaries = LAYER_IDS.map((_, index) =>
    getPoints((column) => getBoundariesKm(column)[index]),
  );
  const bands: Band[] = [
    {
      id: 'water',
      polygon: getPolygon(topOfGround, boundaries[0]),
      top: getPointsAttribute(topOfGround),
    },
    ...LAYER_IDS.map((id, index) => ({
      id,
      polygon: getPolygon(boundaries[index], boundaries[index + 1] ?? bottom),
      top: getPointsAttribute(boundaries[index]),
    })),
  ];
  const grid = scale.ticks
    .filter(({ depthKm }) => depthKm > 10 && depthKm < scale.bottomDepthKm)
    .map(({ depthKm }) => getPointsAttribute(getPoints(() => depthKm)));
  return {
    clip: getPolygon(topOfGround, bottom),
    bands,
    surface: getPointsAttribute(boundaries[0]),
    seaLevel: getPointsAttribute(getPoints(() => 0)),
    grid,
  };
}

function getBackOpacity(index: number, near: number, far: number): number {
  const t = (index - 1) / (SLICE_LOOK.backLines - 1);
  return getRounded((near + (far - near) * t) * 1000) / 1000;
}

function getLandRuns(points: readonly Point[], elevations: ArrayLike<number>): string[] {
  const runs: Point[][] = [];
  let run: Point[] = [];
  points.forEach((point, index) => {
    if (elevations[index] > 0) {
      run.push(point);
      return;
    }
    if (run.length > 1) runs.push(run);
    run = [];
  });
  if (run.length > 1) runs.push(run);
  return runs.map(getPointsAttribute);
}

function getBackLines(input: SectionInput, scale: DepthScale): BackLine[] {
  const { backStepX, backStepY } = SECTION_LOOK;
  return Array.from({ length: SLICE_LOOK.backLines }, (_, offset) => {
    const index = SLICE_LOOK.backLines - offset;
    const elevations = input.elevationsM[index];
    const shiftX = backStepX * index;
    const shiftY = backStepY * index;
    const points = Array.from(elevations, (elevationM, sample): Point => [
      SECTION_FRAME.getX(getSliceAlongKm(sample)) + shiftX,
      scale.getY(-elevationM / 1000) + shiftY,
    ]);
    const baseline: Point[] = [
      [points[0][0], scale.bottomY + shiftY],
      [points.at(-1)?.[0] ?? 0, scale.bottomY + shiftY],
    ];
    return {
      index,
      polygon: getPointsAttribute([...points, ...baseline.toReversed()]),
      line: getPointsAttribute(points),
      land: getLandRuns(points, elevations),
      opacity: getBackOpacity(index, SECTION_LOOK.backOpacityNear, SECTION_LOOK.backOpacityFar),
      landOpacity: getBackOpacity(index, SECTION_LOOK.landOpacityNear, SECTION_LOOK.landOpacityFar),
    };
  });
}

function getRuns(points: readonly (Point | null)[]): Point[][] {
  const runs: Point[][] = [];
  let run: Point[] = [];
  for (const point of points) {
    if (point) {
      run.push(point);
      continue;
    }
    if (run.length > 1) runs.push(run);
    run = [];
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

function getSlabPoints(
  line: readonly LngLat[],
  input: SectionInput,
  scale: DepthScale,
  shift: Point,
): (Point | null)[] {
  return line.map(([lon, lat], sample) => {
    const depthKm = input.getSlabDepthKm(lon, lat);
    if (depthKm === null || depthKm > scale.bottomDepthKm) return null;
    return [SECTION_FRAME.getX(getSliceAlongKm(sample)) + shift[0], scale.getY(depthKm) + shift[1]];
  });
}

function getDeepestPoint(runs: readonly Point[][]): Point {
  return runs.flat().reduce((deepest, point) => (point[1] > deepest[1] ? point : deepest));
}

function getSlabLabel([x, y]: Point, scale: DepthScale): SlabLabel {
  const { slabLabelOffset, slabLabelBottomGap } = SECTION_LOOK;
  const labelY = Math.min(y + slabLabelOffset.y, scale.bottomY - slabLabelBottomGap);
  if (x < SECTION_FRAME.centre) return { x: x + slabLabelOffset.x, y: labelY, anchor: 'start' };
  return { x: x - slabLabelOffset.x, y: labelY, anchor: 'end' };
}

function getSlab(
  lines: readonly LngLat[][],
  frontColumns: readonly Column[],
  input: SectionInput,
  scale: DepthScale,
): Slab | null {
  const frontPoints = getSlabPoints(lines[0], input, scale, [0, 0]);
  const front = getRuns(frontPoints);
  if (front.length === 0) return null;
  const echoes = SECTION_LOOK.echoOpacities.map((opacity, echo) => {
    const points = frontPoints.map((point, sample) => {
      if (!point) return null;
      const mohoY = scale.getY(getBoundariesKm(frontColumns[sample]).at(-1) ?? 0);
      const y = Math.max(point[1], mohoY) + SECTION_LOOK.echoGapPx * (echo + 1);
      return [point[0], y] satisfies Point;
    });
    return { runs: getRuns(points).map(getPointsAttribute), opacity };
  });
  const back = lines
    .map((line, index) => ({ line, index }))
    .filter(({ index }) => index > 0 && index % SECTION_LOOK.slabBackEvery === 0)
    .map(({ line, index }, order) => {
      const shift: Point = [SECTION_LOOK.backStepX * index, SECTION_LOOK.backStepY * index];
      return {
        runs: getRuns(getSlabPoints(line, input, scale, shift)).map(getPointsAttribute),
        opacity:
          getRounded(
            (SECTION_LOOK.slabBackOpacityNear - SECTION_LOOK.slabBackOpacityStep * order) * 100,
          ) / 100,
      };
    })
    .filter(({ runs }) => runs.length > 0);
  const centre = (SLICE_LOOK.samples - 1) / 2;
  const [lon, lat] = lines[0][centre];
  return {
    front: front.map(getPointsAttribute),
    echoes,
    back,
    label: getSlabLabel(getDeepestPoint(front), scale),
    depthAtEpicentreKm: input.getSlabDepthKm(lon, lat),
  };
}

function getOtherRadius(magnitude: number): number {
  return Math.min(7, Math.max(2.5, 0.9 * magnitude - 0.3));
}

function getSurfaceY(columns: readonly Column[], x: number, scale: DepthScale): number {
  const nearest = columns.reduce((best, column) =>
    Math.abs(column.x - x) < Math.abs(best.x - x) ? column : best,
  );
  return scale.getY(Math.min(0, nearest.surfaceKm));
}

type SliceNeighbour = { earthquake: Earthquake; alongKm: number };

function getSliceNeighbours(input: SectionInput): SliceNeighbour[] {
  const halfKm = SECTION_FRAME.sliceKm / 2;
  return input.others.flatMap((other) => {
    if (other.id === input.earthquake.id) return [];
    const { alongKm, northKm } = getSliceOffset(input.earthquake, other);
    if (Math.abs(northKm) > SECTION_LOOK.corridorKm || Math.abs(alongKm) > halfKm) return [];
    return [{ earthquake: other, alongKm }];
  });
}

function getOtherMarks(
  neighbours: readonly SliceNeighbour[],
  columns: readonly Column[],
  scale: DepthScale,
): OtherMark[] {
  return neighbours.map(({ earthquake, alongKm }) => {
    const x = SECTION_FRAME.getX(alongKm);
    return {
      id: earthquake.id,
      x,
      topY: getSurfaceY(columns, x, scale),
      y: scale.getY(Math.min(earthquake.depthKm, scale.bottomDepthKm)),
      radius: getOtherRadius(earthquake.magnitude),
    };
  });
}

function getLayer(column: Column, depthKm: number): LayerId {
  if (depthKm < column.surfaceKm) return 'water';
  const boundaries = getBoundariesKm(column);
  const index = boundaries.findIndex((boundaryKm) => depthKm < boundaryKm);
  return index === -1 ? 'mantle' : LAYER_IDS[index - 1];
}

function getMaxDepthKm(earthquake: Earthquake, neighbours: readonly SliceNeighbour[]): number {
  return neighbours.reduce(
    (deepest, neighbour) => Math.max(deepest, neighbour.earthquake.depthKm),
    earthquake.depthKm,
  );
}

export function getSectionModel(input: SectionInput): SectionModel {
  const { earthquake } = input;
  const neighbours = getSliceNeighbours(input);
  const scale = getDepthScale(getMaxDepthKm(earthquake, neighbours));
  const lines = getSliceLines(earthquake.latitude, earthquake.longitude);
  const frontColumns = lines[0].map(([lon, lat], sample): Column => ({
    x: SECTION_FRAME.getX(getSliceAlongKm(sample)),
    shiftY: 0,
    surfaceKm: -input.elevationsM[0][sample] / 1000,
    crust: input.getCrust(lon, lat),
  }));
  const last = SLICE_LOOK.samples - 1;
  const eastColumns = lines.map((line, index): Column => {
    const [lon, lat] = line[last];
    return {
      x: SECTION_FRAME.right + SECTION_LOOK.backStepX * index,
      shiftY: SECTION_LOOK.backStepY * index,
      surfaceKm: -input.elevationsM[index][last] / 1000,
      crust: input.getCrust(lon, lat),
    };
  });
  const centreColumn = frontColumns[last / 2];
  const slab = getSlab(lines, frontColumns, input, scale);
  const { sedimentsKm, upperKm, middleKm, lowerKm } = centreColumn.crust;

  return {
    scale,
    backLines: getBackLines(input, scale),
    front: getFace(frontColumns, scale),
    east: getFace(eastColumns, scale),
    slab,
    hypocentre: {
      x: SECTION_FRAME.centre,
      y: scale.getY(earthquake.depthKm),
      surfaceY: scale.getY(Math.min(0, centreColumn.surfaceKm)),
    },
    others: getOtherMarks(neighbours, frontColumns, scale),
    facts: {
      layer: getLayer(centreColumn, earthquake.depthKm),
      surfaceElevationM: -centreColumn.surfaceKm * 1000,
      crustThicknessKm: getRounded(sedimentsKm + upperKm + middleKm + lowerKm),
      slabDepthKm: slab?.depthAtEpicentreKm ?? null,
    },
  };
}
