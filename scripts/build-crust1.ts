import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const CELL_COUNT = 360 * 180;
const VALUES_PER_CELL = 9;
const OUTPUT_PATH = path.resolve(import.meta.dirname, '../data/crust1.bin');

function getBoundaryUnits(bnds: string): Int16Array {
  const lines = bnds.split('\n').filter((line) => line.trim() !== '');
  if (lines.length !== CELL_COUNT) {
    throw new Error(`Expected ${CELL_COUNT} lines, got ${lines.length}`);
  }
  const units = new Int16Array(CELL_COUNT * VALUES_PER_CELL);
  lines.forEach((line, cell) => {
    const values = line.trim().split(/\s+/).map(Number);
    if (values.length !== VALUES_PER_CELL) {
      throw new Error(`Line ${cell + 1}: expected ${VALUES_PER_CELL} values, got ${values.length}`);
    }
    values.forEach((km, index) => {
      const value = Math.round(km * 100);
      if (!Number.isInteger(value) || value < -32768 || value > 32767) {
        throw new Error(`Line ${cell + 1}: ${km} km does not fit Int16 in 10 m units`);
      }
      if (Math.abs(value / 100 - km) > 1e-9) {
        throw new Error(`Line ${cell + 1}: ${km} km does not round-trip to 0.01 km`);
      }
      units[cell * VALUES_PER_CELL + index] = value;
    });
  });
  return units;
}

const bndsPath = process.argv[2];
if (!bndsPath) {
  throw new Error('Usage: node scripts/build-crust1.ts <path/to/crust1.bnds>');
}

const units = getBoundaryUnits(readFileSync(bndsPath, 'utf8'));
const bytes = Buffer.alloc(units.length * 2);
units.forEach((value, index) => bytes.writeInt16LE(value, index * 2));
writeFileSync(OUTPUT_PATH, bytes);
console.log(`Wrote ${bytes.length} bytes to ${OUTPUT_PATH}`);
