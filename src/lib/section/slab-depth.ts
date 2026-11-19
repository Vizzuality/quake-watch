export type SlabGrid = {
  west: number;
  south: number;
  step: number;
  columns: number;
  rows: number;
  depthsKm: ArrayLike<number>;
};

export const SLAB_DEPTHS_URL = '/data/slab2-depths.v1.bin';

const MAGIC = 'SLB2';
const HEADER_BYTES = 8;
const REGION_HEADER_BYTES = 16;
const NO_DEPTH = 0xffff;
const KM_PER_UNIT = 0.1;
const MIN_MAPPED_WEIGHT = 0.5;

function getRegionBytes({ columns, rows }: SlabGrid): number {
  return REGION_HEADER_BYTES + columns * rows * 2;
}

export function getSlabGridsBuffer(grids: readonly SlabGrid[]): Uint8Array<ArrayBuffer> {
  const length = grids.reduce((total, grid) => total + getRegionBytes(grid), HEADER_BYTES);
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode(MAGIC));
  view.setUint16(4, grids.length, true);
  let offset = HEADER_BYTES;
  for (const grid of grids) {
    view.setFloat32(offset, grid.west, true);
    view.setFloat32(offset + 4, grid.south, true);
    view.setFloat32(offset + 8, grid.step, true);
    view.setUint16(offset + 12, grid.columns, true);
    view.setUint16(offset + 14, grid.rows, true);
    offset += REGION_HEADER_BYTES;
    for (let index = 0; index < grid.columns * grid.rows; index++) {
      const depthKm = grid.depthsKm[index];
      const units = Number.isNaN(depthKm) ? NO_DEPTH : Math.round(depthKm / KM_PER_UNIT);
      view.setUint16(offset, Math.min(NO_DEPTH, units), true);
      offset += 2;
    }
  }
  return bytes;
}

export function getDecodedSlabGrids(bytes: Uint8Array): SlabGrid[] {
  if (new TextDecoder().decode(bytes.subarray(0, MAGIC.length)) !== MAGIC) {
    throw new Error('Not a Slab2 depth file');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(4, true);
  const grids: SlabGrid[] = [];
  let offset = HEADER_BYTES;
  for (let region = 0; region < count; region++) {
    const columns = view.getUint16(offset + 12, true);
    const rows = view.getUint16(offset + 14, true);
    const depthsKm = new Float32Array(columns * rows);
    for (let index = 0; index < depthsKm.length; index++) {
      const units = view.getUint16(offset + REGION_HEADER_BYTES + index * 2, true);
      depthsKm[index] = units === NO_DEPTH ? Number.NaN : units * KM_PER_UNIT;
    }
    grids.push({
      west: view.getFloat32(offset, true),
      south: view.getFloat32(offset + 4, true),
      step: view.getFloat32(offset + 8, true),
      columns,
      rows,
      depthsKm,
    });
    offset += REGION_HEADER_BYTES + columns * rows * 2;
  }
  return grids;
}

function getGridDepthKm(grid: SlabGrid, lat: number, lon: number): number | null {
  const east = grid.west + ((((lon - grid.west) % 360) + 360) % 360);
  const x = (east - grid.west) / grid.step;
  const y = (lat - grid.south) / grid.step;
  const column = Math.min(Math.floor(x), grid.columns - 2);
  const row = Math.min(Math.floor(y), grid.rows - 2);
  if (column < 0 || row < 0 || x > grid.columns - 1 || y > grid.rows - 1) return null;
  const fx = x - column;
  const fy = y - row;
  const corners = [
    { depthKm: grid.depthsKm[row * grid.columns + column], weight: (1 - fx) * (1 - fy) },
    { depthKm: grid.depthsKm[row * grid.columns + column + 1], weight: fx * (1 - fy) },
    { depthKm: grid.depthsKm[(row + 1) * grid.columns + column], weight: (1 - fx) * fy },
    { depthKm: grid.depthsKm[(row + 1) * grid.columns + column + 1], weight: fx * fy },
  ].filter(({ depthKm }) => !Number.isNaN(depthKm));
  const weight = corners.reduce((total, corner) => total + corner.weight, 0);
  if (weight < MIN_MAPPED_WEIGHT) return null;
  return corners.reduce((total, corner) => total + corner.depthKm * corner.weight, 0) / weight;
}

export function getSlabDepthKm(
  grids: readonly SlabGrid[],
  lat: number,
  lon: number,
): number | null {
  for (const grid of grids) {
    const depthKm = getGridDepthKm(grid, lat, lon);
    if (depthKm !== null) return depthKm;
  }
  return null;
}
