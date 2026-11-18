import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const { SLAB_DEPTHS_URL, getSlabGridsBuffer }: typeof import('../src/lib/section/slab-depth') =
  await import(new URL('../src/lib/section/slab-depth.ts', import.meta.url).href);

type SlabGrid = import('../src/lib/section/slab-depth').SlabGrid;

const SOURCE_URL = 'https://www.sciencebase.gov/catalog/item/5aa1b00ee4b0b1c392e86467';
const OUTPUT_PATH = path.resolve(import.meta.dirname, '../public', `.${SLAB_DEPTHS_URL}`);
const SOURCE_STEP = 0.05;
const STEP = 0.2;
const STRIDE = Math.round(STEP / SOURCE_STEP);
const DEPTH_FILE = /^[a-z]{3}_slab2_dep_[\d.]+\.xyz$/;

function getExtent(values: number[]): [number, number] {
  return values.reduce<[number, number]>(
    ([min, max], value) => [Math.min(min, value), Math.max(max, value)],
    [Infinity, -Infinity],
  );
}

function getRegionGrid(file: string): SlabGrid | null {
  const points = readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .map((line) => line.split(',').map(Number))
    .filter(([, , depth]) => !Number.isNaN(depth));
  if (points.length === 0) return null;
  const [minLon, maxLon] = getExtent(points.map(([lon]) => lon));
  const [minLat, maxLat] = getExtent(points.map(([, lat]) => lat));
  const west = Math.floor(minLon / STEP) * STEP;
  const south = Math.floor(minLat / STEP) * STEP;
  const columns = Math.ceil((maxLon - west) / STEP) + 1;
  const rows = Math.ceil((maxLat - south) / STEP) + 1;
  const depthsKm = new Float32Array(columns * rows).fill(Number.NaN);
  for (const [lon, lat, depth] of points) {
    const column = Math.round((lon - west) / SOURCE_STEP);
    const row = Math.round((lat - south) / SOURCE_STEP);
    if (column % STRIDE !== 0 || row % STRIDE !== 0) continue;
    depthsKm[(row / STRIDE) * columns + column / STRIDE] = -depth;
  }
  return { west, south, step: STEP, columns, rows, depthsKm };
}

const inputDir = process.argv[2];
if (!inputDir) {
  throw new Error(
    `Usage: node scripts/build-slab-depths.ts <folder of *_slab2_dep_*.xyz from each region of ${SOURCE_URL}>`,
  );
}

const files = readdirSync(inputDir).filter((name) => DEPTH_FILE.test(name));
const grids = files
  .map((name) => getRegionGrid(path.join(inputDir, name)))
  .filter((grid): grid is SlabGrid => grid !== null);
const compressed = gzipSync(getSlabGridsBuffer(grids), { level: 9 });

mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, compressed);
console.log(`Wrote ${grids.length} Slab2 regions (${compressed.length} bytes) to ${OUTPUT_PATH}`);
