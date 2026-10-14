import { getRadians } from '@/lib/earthquakes/distance';

import {
  type CrustLayer,
  type DeepBoundary,
  getBlockDepthKm,
  getBlockRadiusCells,
  getBlockSideKm,
  getCrustLayers,
  getDeepBoundariesKm,
  getMohoDepthKm,
  getRuptureStartDepthKm,
  KM_PER_DEGREE,
  PREM_BOUNDARIES_KM,
  RELIEF_EXAGGERATION,
} from './block';
import { getTerrariumElevationM, type TileCoord } from './terrarium';
import {
  CRUST_LAYER_KINDS,
  type CrustCell,
  type CrustCellsInput,
  type CrustLayerKind,
} from './types';

export type GeoPoint = { latitude: number; longitude: number };
export type LocalPoint = { x: number; z: number };
export type RGB = readonly [number, number, number];
export type ColorStop = { value: number; color: RGB };

export const MANTLE_BAND_KINDS = ['upper-mantle', 'transition-zone', 'lower-mantle'] as const;
export type MantleBandKind = (typeof MANTLE_BAND_KINDS)[number];
export type BandKind = CrustLayerKind | MantleBandKind;
export const BAND_KINDS: readonly BandKind[] = [...CRUST_LAYER_KINDS, ...MANTLE_BAND_KINDS];

export type Band = { kind: BandKind; topKm: number; bottomKm: number };

export const DEEP_BOUNDARY_BANDS: Record<DeepBoundary['kind'], MantleBandKind> = {
  'transition-zone-top': 'transition-zone',
  'lower-mantle-top': 'lower-mantle',
};

export type TilePixels = {
  tile: TileCoord;
  width: number;
  height: number;
  data: ArrayLike<number>;
};

export type ElevationGrid = { segments: number; sideKm: number; elevationsM: Float32Array };

export type CrustalBlock = {
  epicenterColumn: CrustCell;
  blockCells: CrustCell[];
  layers: CrustLayer[];
  mohoDepthKm: number;
  blockDepthKm: number;
  sideKm: number;
  ruptureStartDepthKm: number;
  deepBoundaries: DeepBoundary[];
};

export type MeshData = { positions: Float32Array; colors: Float32Array; indices: Uint32Array };

export type BlockMeshInput = {
  cells: readonly CrustCell[];
  origin: GeoPoint;
  sideKm: number;
  blockDepthKm: number;
  segments: number;
  relief: ElevationGrid | null;
  getBandColor: (kind: BandKind, depthKm: number) => RGB;
  getTerrainColor: (elevationM: number) => RGB;
};

export type BlockMeshData = {
  terrain: MeshData;
  walls: MeshData;
  water: MeshData;
  outlines: Float32Array;
  mohoLine: Float32Array;
  deepLines: Float32Array;
  topKm: number;
  surfaceAtCenterKm: number;
  labelCornerBands: Band[];
};

export type BlockLabelKind = 'water' | 'crust' | 'moho' | MantleBandKind;
export type BlockLabel = { kind: BlockLabelKind; yKm: number };

export type ProjectedBounds = { minX: number; maxX: number; minY: number; maxY: number };

export type View = { azimuthRad: number; elevationRad: number };

export type BlockFitInput = {
  sideKm: number;
  topKm: number;
  bottomKm: number;
  width: number;
  height: number;
  gutterX: number;
  gutterY: number;
  view: View;
};

export type BlockFit = { scale: number; position: readonly [number, number, number] };

export const BLOCK_SEGMENTS = 96;

const MOHO_UPPER_BOUND_KM = 80;
const GROUND_TOP_INDEX = 1;
const MOHO_INDEX = CRUST_LAYER_KINDS.length;
const MIN_COS_LATITUDE = 0.01;
const TILE_SIZE_FALLBACK = 256;
const MAX_MERCATOR_LATITUDE = 85.051_128_78;
const DEPTH_TICK_STEPS = [10, 20, 50, 100, 200, 500, 1000];
const MAX_DEPTH_TICKS = 5;
const LABEL_PRIORITY: readonly BlockLabelKind[] = [
  'moho',
  'crust',
  'upper-mantle',
  'water',
  'transition-zone',
  'lower-mantle',
];

function getWrappedLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

function getKmPerLongitudeDegree(latitude: number): number {
  return KM_PER_DEGREE * Math.max(Math.cos(getRadians(latitude)), MIN_COS_LATITUDE);
}

function getClamped(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getLocalKm(point: GeoPoint, origin: GeoPoint): LocalPoint {
  const longitudeDelta = getWrappedLongitude(point.longitude - origin.longitude);
  return {
    x: longitudeDelta * getKmPerLongitudeDegree(origin.latitude),
    z: -(point.latitude - origin.latitude) * KM_PER_DEGREE,
  };
}

export function getGeoPoint(point: LocalPoint, origin: GeoPoint): GeoPoint {
  return {
    latitude: origin.latitude - point.z / KM_PER_DEGREE,
    longitude: getWrappedLongitude(
      origin.longitude + point.x / getKmPerLongitudeDegree(origin.latitude),
    ),
  };
}

function getSquaredDistance(a: LocalPoint, b: LocalPoint): number {
  return (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
}

function getNearestCell(
  cells: readonly CrustCell[],
  target: GeoPoint,
  origin: GeoPoint,
): CrustCell {
  const targetKm = getLocalKm(target, origin);
  let nearest = cells[0];
  let nearestDistance = Infinity;
  for (const cell of cells) {
    const distance = getSquaredDistance(getLocalKm(cell, origin), targetKm);
    if (distance < nearestDistance) {
      nearest = cell;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function isCellInBlock(cell: CrustCell, origin: GeoPoint, halfSideKm: number): boolean {
  const centre = getLocalKm(cell, origin);
  const halfWidthKm = getKmPerLongitudeDegree(origin.latitude) / 2;
  const halfHeightKm = KM_PER_DEGREE / 2;
  return (
    Math.abs(centre.x) - halfWidthKm < halfSideKm && Math.abs(centre.z) - halfHeightKm < halfSideKm
  );
}

export function getCrustCellsInput(origin: GeoPoint, depthKm: number): CrustCellsInput {
  const sideKm = getBlockSideKm(getBlockDepthKm(depthKm, MOHO_UPPER_BOUND_KM));
  return { ...origin, radiusCells: getBlockRadiusCells(sideKm, origin.latitude) };
}

export function getCrustalBlock(
  cells: readonly CrustCell[],
  origin: GeoPoint,
  depthKm: number,
): CrustalBlock {
  const epicenterColumn: CrustCell = {
    ...origin,
    boundaryElevationsKm: getBoundaryField(cells, origin)({ x: 0, z: 0 }),
  };
  const mohoDepthKm = getMohoDepthKm(epicenterColumn);
  const blockDepthKm = getBlockDepthKm(depthKm, mohoDepthKm);
  const sideKm = getBlockSideKm(blockDepthKm);
  return {
    epicenterColumn,
    blockCells: cells.filter((cell) => isCellInBlock(cell, origin, sideKm / 2)),
    layers: getCrustLayers(epicenterColumn),
    mohoDepthKm,
    blockDepthKm,
    sideKm,
    ruptureStartDepthKm: getRuptureStartDepthKm(depthKm, blockDepthKm),
    deepBoundaries: getDeepBoundariesKm(blockDepthKm),
  };
}

function getCellKey(latitudeIndex: number, longitudeIndex: number): string {
  return `${latitudeIndex}:${getWrappedLongitude(longitudeIndex)}`;
}

export function getBoundaryField(
  cells: readonly CrustCell[],
  origin: GeoPoint,
): (point: LocalPoint) => number[] {
  const cellsByKey = new Map<string, CrustCell>();
  for (const cell of cells) {
    cellsByKey.set(getCellKey(Math.floor(cell.latitude), Math.floor(cell.longitude)), cell);
  }

  function getCell(latitudeIndex: number, longitudeIndex: number): CrustCell {
    const key = getCellKey(latitudeIndex, longitudeIndex);
    const known = cellsByKey.get(key);
    if (known) return known;
    const centre = { latitude: latitudeIndex + 0.5, longitude: longitudeIndex + 0.5 };
    const nearest = getNearestCell(cells, centre, origin);
    cellsByKey.set(key, nearest);
    return nearest;
  }

  return (point) => {
    const { latitude, longitude } = getGeoPoint(point, origin);
    const u = getUnwrappedLongitude(longitude, origin.longitude) - 0.5;
    const v = latitude - 0.5;
    const longitudeIndex = Math.floor(u);
    const latitudeIndex = Math.floor(v);
    const fu = u - longitudeIndex;
    const fv = v - latitudeIndex;
    const corners = [
      { cell: getCell(latitudeIndex, longitudeIndex), weight: (1 - fu) * (1 - fv) },
      { cell: getCell(latitudeIndex, longitudeIndex + 1), weight: fu * (1 - fv) },
      { cell: getCell(latitudeIndex + 1, longitudeIndex), weight: (1 - fu) * fv },
      { cell: getCell(latitudeIndex + 1, longitudeIndex + 1), weight: fu * fv },
    ];
    const blended = corners[0].cell.boundaryElevationsKm.map((_, index) =>
      corners.reduce((sum, { cell, weight }) => sum + cell.boundaryElevationsKm[index] * weight, 0),
    );
    return [getWaterTopKm(blended[0], blended[GROUND_TOP_INDEX]), ...blended.slice(1)];
  };
}

function getWaterTopKm(blendedWaterTopKm: number, groundTopKm: number): number {
  return groundTopKm >= 0 ? groundTopKm : Math.min(blendedWaterTopKm, 0);
}

function getUnwrappedLongitude(longitude: number, reference: number): number {
  return reference + getWrappedLongitude(longitude - reference);
}

function getMercatorFraction(latitude: number): number {
  const radians = getRadians(getClamped(latitude, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE));
  return (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2;
}

function getTileKey(tile: TileCoord): string {
  return `${tile.z}/${tile.x}/${tile.y}`;
}

function getPixelSampler(tiles: readonly TilePixels[]) {
  const zoom = tiles[0].tile.z;
  const tileSize = tiles[0].width || TILE_SIZE_FALLBACK;
  const worldSize = 2 ** zoom * tileSize;
  const tilesByKey = new Map(tiles.map((pixels) => [getTileKey(pixels.tile), pixels]));

  function getPixelElevationM(globalX: number, globalY: number): number | null {
    const x = ((globalX % worldSize) + worldSize) % worldSize;
    const y = getClamped(globalY, 0, worldSize - 1);
    const tileX = Math.floor(x / tileSize);
    const tileY = Math.floor(y / tileSize);
    const pixels = tilesByKey.get(getTileKey({ z: zoom, x: tileX, y: tileY }));
    if (!pixels) return null;
    const offset = ((y - tileY * tileSize) * pixels.width + (x - tileX * tileSize)) * 4;
    return getTerrariumElevationM(
      pixels.data[offset],
      pixels.data[offset + 1],
      pixels.data[offset + 2],
    );
  }

  return ({ latitude, longitude }: GeoPoint): number | null => {
    const pixelX = ((longitude + 180) / 360) * worldSize - 0.5;
    const pixelY = getMercatorFraction(latitude) * worldSize - 0.5;
    const x0 = Math.floor(pixelX);
    const y0 = Math.floor(pixelY);
    const fx = pixelX - x0;
    const fy = pixelY - y0;
    const samples = [
      getPixelElevationM(x0, y0),
      getPixelElevationM(x0 + 1, y0),
      getPixelElevationM(x0, y0 + 1),
      getPixelElevationM(x0 + 1, y0 + 1),
    ];
    if (samples.some((sample) => sample === null)) {
      return getNearestSample(samples, [
        (1 - fx) * (1 - fy),
        fx * (1 - fy),
        (1 - fx) * fy,
        fx * fy,
      ]);
    }
    const [topLeft, topRight, bottomLeft, bottomRight] = samples as number[];
    const top = topLeft + (topRight - topLeft) * fx;
    const bottom = bottomLeft + (bottomRight - bottomLeft) * fx;
    return top + (bottom - top) * fy;
  };
}

function getNearestSample(
  samples: readonly (number | null)[],
  weights: readonly number[],
): number | null {
  let nearest: number | null = null;
  let nearestWeight = -1;
  samples.forEach((sample, index) => {
    if (sample !== null && weights[index] > nearestWeight) {
      nearest = sample;
      nearestWeight = weights[index];
    }
  });
  return nearest;
}

function getGridPoint(index: number, segments: number, sideKm: number): number {
  return -sideKm / 2 + (index * sideKm) / segments;
}

export function getElevationGrid(
  tiles: readonly TilePixels[],
  origin: GeoPoint,
  sideKm: number,
  segments: number,
): ElevationGrid | null {
  if (tiles.length === 0) return null;
  const getElevationM = getPixelSampler(tiles);
  const elevationsM = new Float32Array((segments + 1) ** 2);
  for (let row = 0; row <= segments; row++) {
    for (let column = 0; column <= segments; column++) {
      const point = {
        x: getGridPoint(column, segments, sideKm),
        z: getGridPoint(row, segments, sideKm),
      };
      const elevationM = getElevationM(getGeoPoint(point, origin));
      if (elevationM === null) return null;
      elevationsM[row * (segments + 1) + column] = elevationM;
    }
  }
  return { segments, sideKm, elevationsM };
}

export function getSurfaceKm(groundTopKm: number, elevationKm: number): number {
  const surfaceKm = groundTopKm + (elevationKm - groundTopKm) * RELIEF_EXAGGERATION;
  return elevationKm < 0 ? Math.min(surfaceKm, elevationKm) : Math.max(surfaceKm, elevationKm);
}

function getTopmostSolidIndex(boundaries: readonly number[]): number {
  for (let index = GROUND_TOP_INDEX; index < MOHO_INDEX; index++) {
    if (boundaries[index] > boundaries[index + 1]) return index;
  }
  return MOHO_INDEX;
}

export function getColumnBands(
  boundaries: readonly number[],
  surfaceKm: number,
  hasWater: boolean,
  blockDepthKm: number,
): Band[] {
  const topmostSolidIndex = getTopmostSolidIndex(boundaries);
  const drawn = boundaries.map((boundary, index) =>
    index <= topmostSolidIndex ? surfaceKm : Math.min(boundary, surfaceKm),
  );
  const waterBottomKm = hasWater ? Math.min(surfaceKm, 0) : 0;
  const transitionTopKm = -Math.min(PREM_BOUNDARIES_KM.transitionZoneTop, blockDepthKm);
  const lowerMantleTopKm = -Math.min(PREM_BOUNDARIES_KM.lowerMantleTop, blockDepthKm);
  const solidBands = CRUST_LAYER_KINDS.slice(1).map((kind, offset) => ({
    kind,
    topKm: drawn[GROUND_TOP_INDEX + offset],
    bottomKm: drawn[GROUND_TOP_INDEX + offset + 1],
  }));
  return [
    { kind: 'water', topKm: 0, bottomKm: waterBottomKm },
    ...solidBands,
    { kind: 'upper-mantle', topKm: drawn[MOHO_INDEX], bottomKm: transitionTopKm },
    { kind: 'transition-zone', topKm: transitionTopKm, bottomKm: lowerMantleTopKm },
    { kind: 'lower-mantle', topKm: lowerMantleTopKm, bottomKm: -blockDepthKm },
  ];
}

type Vertex = {
  x: number;
  z: number;
  elevationKm: number;
  surfaceKm: number;
  hasWater: boolean;
  bands: Band[];
};

type MeshBuilder = { positions: number[]; colors: number[]; indices: number[] };

function getMeshBuilder(): MeshBuilder {
  return { positions: [], colors: [], indices: [] };
}

function getMeshData(builder: MeshBuilder): MeshData {
  return {
    positions: new Float32Array(builder.positions),
    colors: new Float32Array(builder.colors),
    indices: new Uint32Array(builder.indices),
  };
}

function addVertex(builder: MeshBuilder, x: number, y: number, z: number, color: RGB): number {
  builder.positions.push(x, y, z);
  builder.colors.push(...color);
  return builder.positions.length / 3 - 1;
}

function addQuad(builder: MeshBuilder, a: number, b: number, c: number, d: number) {
  builder.indices.push(a, b, c, b, d, c);
}

function isCutAway(column: number, row: number, half: number): boolean {
  return column >= half && row >= half;
}

function getWallPaths(segments: number): { column: number; row: number }[][] {
  const half = segments / 2;
  const getRange = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, index) => from + index);
  return [
    getRange(0, half).map((row) => ({ column: segments, row })),
    getRange(0, half).map((column) => ({ column, row: segments })),
    getRange(0, segments).map((row) => ({ column: 0, row })),
    getRange(0, segments).map((column) => ({ column, row: 0 })),
    getRange(half, segments).map((row) => ({ column: half, row })),
    getRange(half, segments).map((column) => ({ column, row: half })),
  ];
}

function getBandThickness(band: Band): number {
  return band.topKm - band.bottomKm;
}

function addSegment(lines: number[], a: Vertex, aY: number, b: Vertex, bY: number) {
  lines.push(a.x, aY, a.z, b.x, bY, b.z);
}

export function getBlockMeshData(input: BlockMeshInput): BlockMeshData {
  const { segments, sideKm, blockDepthKm, getBandColor, getTerrainColor } = input;
  const field = getBoundaryField(input.cells, input.origin);
  const relief = input.relief?.segments === segments ? input.relief : null;
  const stride = segments + 1;
  const half = segments / 2;

  const vertices: Vertex[] = [];
  for (let row = 0; row <= segments; row++) {
    for (let column = 0; column <= segments; column++) {
      const x = getGridPoint(column, segments, sideKm);
      const z = getGridPoint(row, segments, sideKm);
      const boundaries = field({ x, z });
      const groundTopKm = boundaries[GROUND_TOP_INDEX];
      const elevationKm = relief ? relief.elevationsM[row * stride + column] / 1000 : groundTopKm;
      const surfaceKm = relief ? getSurfaceKm(groundTopKm, elevationKm) : groundTopKm;
      const hasWater = elevationKm < 0 && boundaries[0] > boundaries[GROUND_TOP_INDEX];
      const bands = getColumnBands(boundaries, surfaceKm, hasWater, blockDepthKm);
      vertices.push({ x, z, elevationKm, surfaceKm, hasWater, bands });
    }
  }
  const getVertex = (column: number, row: number) => vertices[row * stride + column];

  const terrain = getMeshBuilder();
  for (const vertex of vertices) {
    addVertex(
      terrain,
      vertex.x,
      vertex.surfaceKm,
      vertex.z,
      getTerrainColor(vertex.elevationKm * 1000),
    );
  }
  const water = getMeshBuilder();
  const waterColor = getBandColor('water', 0);
  for (let row = 0; row < segments; row++) {
    for (let column = 0; column < segments; column++) {
      if (isCutAway(column, row, half)) continue;
      const corners = [
        getVertex(column, row),
        getVertex(column + 1, row),
        getVertex(column, row + 1),
        getVertex(column + 1, row + 1),
      ];
      addQuad(
        terrain,
        row * stride + column,
        (row + 1) * stride + column,
        row * stride + column + 1,
        (row + 1) * stride + column + 1,
      );
      if (corners.some((corner) => corner.hasWater)) {
        const [a, b, c, d] = corners.map((corner) =>
          addVertex(water, corner.x, 0, corner.z, waterColor),
        );
        addQuad(water, a, c, b, d);
      }
    }
  }

  const walls = getMeshBuilder();
  const outlines: number[] = [];
  const mohoLine: number[] = [];
  const deepLines: number[] = [];
  const deepDepthsKm = getDeepBoundariesKm(blockDepthKm).map((boundary) => boundary.depthKm);
  for (const path of getWallPaths(segments)) {
    const pathVertices = path.map(({ column, row }) => getVertex(column, row));
    for (const end of [pathVertices[0], pathVertices[pathVertices.length - 1]]) {
      addSegment(outlines, end, end.surfaceKm, end, -blockDepthKm);
    }
    pathVertices.slice(1).forEach((b, offset) => {
      const a = pathVertices[offset];
      addSegment(outlines, a, a.surfaceKm, b, b.surfaceKm);
      addSegment(outlines, a, -blockDepthKm, b, -blockDepthKm);
      const mohoIndex = BAND_KINDS.indexOf('upper-mantle');
      addSegment(mohoLine, a, a.bands[mohoIndex].topKm, b, b.bands[mohoIndex].topKm);
      for (const depthKm of deepDepthsKm) addSegment(deepLines, a, -depthKm, b, -depthKm);
      a.bands.forEach((bandA, bandIndex) => {
        const bandB = b.bands[bandIndex];
        if (getBandThickness(bandA) <= 0 && getBandThickness(bandB) <= 0) return;
        const builder = bandA.kind === 'water' ? water : walls;
        const getColor = (y: number) => getBandColor(bandA.kind, -y);
        addQuad(
          builder,
          addVertex(builder, a.x, bandA.topKm, a.z, getColor(bandA.topKm)),
          addVertex(builder, a.x, bandA.bottomKm, a.z, getColor(bandA.bottomKm)),
          addVertex(builder, b.x, bandB.topKm, b.z, getColor(bandB.topKm)),
          addVertex(builder, b.x, bandB.bottomKm, b.z, getColor(bandB.bottomKm)),
        );
      });
    });
  }
  const center = getVertex(half, half);

  return {
    terrain: getMeshData(terrain),
    walls: getMeshData(walls),
    water: getMeshData(water),
    outlines: new Float32Array(outlines),
    mohoLine: new Float32Array(mohoLine),
    deepLines: new Float32Array(deepLines),
    topKm: Math.max(0, ...vertices.map((vertex) => vertex.surfaceKm)),
    surfaceAtCenterKm: center.surfaceKm,
    labelCornerBands: getVertex(segments, 0).bands,
  };
}

function getBandMiddleKm(band: Band): number {
  return (band.topKm + band.bottomKm) / 2;
}

function getLabelCandidates(bands: readonly Band[]): BlockLabel[] {
  const getBand = (kind: BandKind) => bands.find((band) => band.kind === kind)!;
  const solidBands = bands.filter(
    (band) => band.kind !== 'water' && !MANTLE_BAND_KINDS.includes(band.kind as MantleBandKind),
  );
  const crustTopKm = Math.max(...solidBands.map((band) => band.topKm));
  const mohoKm = getBand('upper-mantle').topKm;
  const candidates: BlockLabel[] = [
    { kind: 'crust', yKm: (crustTopKm + mohoKm) / 2 },
    { kind: 'moho', yKm: mohoKm },
  ];
  const optionalKinds: BlockLabelKind[] = ['water', ...MANTLE_BAND_KINDS];
  for (const kind of optionalKinds) {
    const band = getBand(kind as BandKind);
    if (getBandThickness(band) > 0) candidates.push({ kind, yKm: getBandMiddleKm(band) });
  }
  return candidates;
}

export function getBlockLabels(bands: readonly Band[], minGapKm: number): BlockLabel[] {
  const candidates = getLabelCandidates(bands);
  const accepted: BlockLabel[] = [];
  for (const kind of LABEL_PRIORITY) {
    const candidate = candidates.find((label) => label.kind === kind);
    if (!candidate) continue;
    if (accepted.every((label) => Math.abs(label.yKm - candidate.yKm) >= minGapKm)) {
      accepted.push(candidate);
    }
  }
  return accepted.sort((a, b) => b.yKm - a.yKm);
}

export function getDepthTicks(blockDepthKm: number): number[] {
  const step =
    DEPTH_TICK_STEPS.find((candidate) => blockDepthKm / candidate <= MAX_DEPTH_TICKS) ??
    DEPTH_TICK_STEPS[DEPTH_TICK_STEPS.length - 1];
  const count = Math.floor(blockDepthKm / step);
  return Array.from({ length: count + 1 }, (_, index) => index * step);
}

type Vector3 = readonly [number, number, number];

function getViewBasis({ azimuthRad, elevationRad }: View): { right: Vector3; up: Vector3 } {
  return {
    right: [Math.cos(azimuthRad), 0, -Math.sin(azimuthRad)],
    up: [
      -Math.sin(azimuthRad) * Math.sin(elevationRad),
      Math.cos(elevationRad),
      -Math.cos(azimuthRad) * Math.sin(elevationRad),
    ],
  };
}

function getDot(a: Vector3, b: Vector3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function getProjectedBounds(
  points: readonly Vector3[],
  azimuthRad: number,
  elevationRad: number,
): ProjectedBounds {
  const { right, up } = getViewBasis({ azimuthRad, elevationRad });
  const xs = points.map((point) => getDot(point, right));
  const ys = points.map((point) => getDot(point, up));
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

export function getBlockFit(input: BlockFitInput): BlockFit {
  const half = input.sideKm / 2;
  const corners = [-half, half].flatMap((x) =>
    [-half, half].flatMap((z) => [input.topKm, input.bottomKm].map((y): Vector3 => [x, y, z])),
  );
  const bounds = getProjectedBounds(corners, input.view.azimuthRad, input.view.elevationRad);
  const scale = Math.min(
    (input.width - 2 * input.gutterX) / (bounds.maxX - bounds.minX),
    (input.height - 2 * input.gutterY) / (bounds.maxY - bounds.minY),
  );
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const { right, up } = getViewBasis(input.view);
  const position = [0, 1, 2].map(
    (axis) => -(centerX * right[axis] + centerY * up[axis]) * scale,
  ) as unknown as Vector3;
  return { scale, position };
}

export function getRampColor(stops: readonly ColorStop[], value: number): RGB {
  const upperIndex = stops.findIndex((stop) => stop.value >= value);
  if (upperIndex === -1) return stops[stops.length - 1].color;
  if (upperIndex === 0) return stops[0].color;
  const lower = stops[upperIndex - 1];
  const upper = stops[upperIndex];
  const t = (value - lower.value) / (upper.value - lower.value);
  return [0, 1, 2].map(
    (channel) => lower.color[channel] + (upper.color[channel] - lower.color[channel]) * t,
  ) as unknown as RGB;
}

export function getRgb(hex: string): RGB {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}
