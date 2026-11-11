import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const { GLOBE_DOT_COUNT }: typeof import('../src/lib/globe/look') = await import(
  new URL('../src/lib/globe/look.ts', import.meta.url).href
);
const {
  getFibonacciPoints,
  getLatLonVector,
  getPointLatLon,
}: typeof import('../src/lib/globe/sphere') = await import(
  new URL('../src/lib/globe/sphere.ts', import.meta.url).href
);

type Ring = [number, number][];
type Geometry =
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] };

const OUTPUT_PATH = path.resolve(import.meta.dirname, '../src/lib/globe/land-mask.data.ts');
const SOURCE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_land.geojson';
const ISLAND_SOURCE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_land.geojson';

function getRings(geometry: Geometry): Ring[] {
  return geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();
}

function getOuterRings(geometry: Geometry): Ring[] {
  return geometry.type === 'Polygon'
    ? [geometry.coordinates[0]]
    : geometry.coordinates.map((polygon) => polygon[0]);
}

const LAND_COVERAGE = 0.5;
const CELL_RADIUS = Math.sqrt((4 * Math.PI) / GLOBE_DOT_COUNT) / 2;
const CELL_RINGS = [
  { radius: 0, count: 1 },
  { radius: CELL_RADIUS / 2, count: 6 },
  { radius: CELL_RADIUS, count: 12 },
];

function getOffsetLatLon(lat: number, lon: number, distance: number, bearing: number) {
  const phi = (lat * Math.PI) / 180;
  const lambda = (lon * Math.PI) / 180;
  const phi2 = Math.asin(
    Math.sin(phi) * Math.cos(distance) + Math.cos(phi) * Math.sin(distance) * Math.cos(bearing),
  );
  const lambda2 =
    lambda +
    Math.atan2(
      Math.sin(bearing) * Math.sin(distance) * Math.cos(phi),
      Math.cos(distance) - Math.sin(phi) * Math.sin(phi2),
    );
  return { lat: (phi2 * 180) / Math.PI, lon: (((lambda2 * 180) / Math.PI + 540) % 360) - 180 };
}

function getCellSamples(lat: number, lon: number) {
  return CELL_RINGS.flatMap(({ radius, count }) =>
    Array.from({ length: count }, (_, k) =>
      getOffsetLatLon(lat, lon, radius, (2 * Math.PI * k) / count),
    ),
  );
}

function isInsideRing(ring: Ring, lon: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

type Bounds = { west: number; east: number; south: number; north: number };

function getRingBounds(ring: Ring): Bounds {
  const lons = ring.map(([lon]) => lon);
  const lats = ring.map(([, lat]) => lat);
  return {
    west: Math.min(...lons),
    east: Math.max(...lons),
    south: Math.min(...lats),
    north: Math.max(...lats),
  };
}

function isInsideBounds(bounds: Bounds, lon: number, lat: number): boolean {
  return lon >= bounds.west && lon <= bounds.east && lat >= bounds.south && lat <= bounds.north;
}

function getMeanLatLon(ring: Ring) {
  const sum = [0, 0, 0];
  for (const [lon, lat] of ring) {
    getLatLonVector(lat, lon).forEach((value, axis) => (sum[axis] += value));
  }
  const [x, y, z] = sum.map((value) => value / Math.hypot(...sum));
  return getPointLatLon(x, y, z);
}

function getScanlineLatLon(ring: Ring, bounds: Bounds) {
  const lat = (bounds.south + bounds.north) / 2;
  const crossings: number[] = [];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat) crossings.push(((xj - xi) * (lat - yi)) / (yj - yi) + xi);
  }
  crossings.sort((a, b) => a - b);
  return { lat, lon: (crossings[0] + crossings[1]) / 2 };
}

function getInteriorLatLon(ring: Ring, bounds: Bounds) {
  const mean = getMeanLatLon(ring);
  if (isInsideRing(ring, mean.lon, mean.lat)) return mean;
  return getScanlineLatLon(ring, bounds);
}

const [inputPath, islandInputPath] = process.argv.slice(2);
if (!inputPath || !islandInputPath)
  throw new Error(
    `Usage: node scripts/build-globe-land.ts <ne_110m_land.geojson from ${SOURCE_URL}> <ne_50m_land.geojson from ${ISLAND_SOURCE_URL}>`,
  );

function getGeometries(filePath: string): Geometry[] {
  const { features } = JSON.parse(readFileSync(filePath, 'utf8')) as {
    features: { geometry: Geometry }[];
  };
  return features.map(({ geometry }) => geometry);
}

const rings = getGeometries(inputPath).flatMap(getRings);

function isLand(lat: number, lon: number): boolean {
  return rings.filter((ring) => isInsideRing(ring, lon, lat)).length % 2 === 1;
}
const points = getFibonacciPoints(GLOBE_DOT_COUNT);
const pointLatLons = Array.from({ length: GLOBE_DOT_COUNT }, (_, i) =>
  getPointLatLon(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]),
);
const bits = new Uint8Array(Math.ceil(GLOBE_DOT_COUNT / 8));
let landCount = 0;

function isLandPoint(index: number): boolean {
  return ((bits[index >> 3] >> (index & 7)) & 1) === 1;
}

function setLandPoint(index: number) {
  if (isLandPoint(index)) return;
  bits[index >> 3] |= 1 << (index & 7);
  landCount++;
}

function getNearestPointIndex(lat: number, lon: number): number {
  const [x, y, z] = getLatLonVector(lat, lon);
  let nearest = 0;
  let nearestDot = -Infinity;
  for (let i = 0; i < GLOBE_DOT_COUNT; i++) {
    const dot = points[i * 3] * x + points[i * 3 + 1] * y + points[i * 3 + 2] * z;
    if (dot > nearestDot) {
      nearestDot = dot;
      nearest = i;
    }
  }
  return nearest;
}

function hasLandPointInside(ring: Ring, bounds: Bounds): boolean {
  return pointLatLons.some(
    ({ lat, lon }, i) =>
      isLandPoint(i) && isInsideBounds(bounds, lon, lat) && isInsideRing(ring, lon, lat),
  );
}

for (let i = 0; i < GLOBE_DOT_COUNT; i++) {
  const { lat, lon } = pointLatLons[i];
  const samples = getCellSamples(lat, lon);
  const landSamples = samples.filter((sample) => isLand(sample.lat, sample.lon)).length;
  if (landSamples / samples.length >= LAND_COVERAGE) setLandPoint(i);
}

const baseLandCount = landCount;
const islandRings = getGeometries(islandInputPath).flatMap(getOuterRings);
for (const ring of islandRings) {
  const bounds = getRingBounds(ring);
  if (hasLandPointInside(ring, bounds)) continue;
  const { lat, lon } = getInteriorLatLon(ring, bounds);
  setLandPoint(getNearestPointIndex(lat, lon));
}

const base64 = Buffer.from(bits).toString('base64');
writeFileSync(
  OUTPUT_PATH,
  `// Generated by scripts/build-globe-land.ts from Natural Earth 1:110m land and 1:50m islands (public domain): ${SOURCE_URL} ${ISLAND_SOURCE_URL}\n` +
    `export const LAND_MASK_POINT_COUNT = ${GLOBE_DOT_COUNT};\n` +
    `export const LAND_MASK_BASE64 =\n  '${base64}';\n`,
);
console.log(
  `Wrote ${landCount}/${GLOBE_DOT_COUNT} land points (${landCount - baseLandCount} for islands) to ${OUTPUT_PATH}`,
);
