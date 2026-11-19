import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const {
  CRUST_CELL_COUNT,
  CRUST_LAYERS_URL,
  getCrustLayersBuffer,
}: typeof import('../src/lib/section/crust-layers') = await import(
  new URL('../src/lib/section/crust-layers.ts', import.meta.url).href
);

const SOURCE_URL = 'https://igppweb.ucsd.edu/~gabi/crust1/crust1.0.tar.gz';
const OUTPUT_PATH = path.resolve(import.meta.dirname, '../public', `.${CRUST_LAYERS_URL}`);

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error(`Usage: node scripts/build-crust-layers.ts <crust1.bnds from ${SOURCE_URL}>`);
}

const rows = readFileSync(inputPath, 'utf8')
  .trim()
  .split('\n')
  .map((line) => line.trim().split(/\s+/).map(Number));
if (rows.length !== CRUST_CELL_COUNT || rows.some((row) => row.length !== 9)) {
  throw new Error(`Expected ${CRUST_CELL_COUNT} rows of 9 boundaries in ${inputPath}`);
}

const columns = rows.map((top) => ({
  sedimentsKm: top[2] - top[5],
  upperKm: top[5] - top[6],
  middleKm: top[6] - top[7],
  lowerKm: top[7] - top[8],
}));
const compressed = gzipSync(getCrustLayersBuffer(columns), { level: 9 });

mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, compressed);
console.log(
  `Wrote ${columns.length} CRUST1.0 cells (${compressed.length} bytes) to ${OUTPUT_PATH}`,
);
