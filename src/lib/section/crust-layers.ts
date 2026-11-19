export type CrustColumn = {
  sedimentsKm: number;
  upperKm: number;
  middleKm: number;
  lowerKm: number;
};

export type CrustGrid = { thicknesses: Uint8Array };

export const CRUST_LAYERS_URL = '/data/crust1-layers.v1.bin';
export const CRUST_CELL_COUNT = 360 * 180;

const MAGIC = 'CRS1';
const LAYERS_PER_CELL = 4;
const KM_PER_UNIT = 0.2;
const MAX_UNITS = 255;

function getUnits(km: number): number {
  return Math.min(MAX_UNITS, Math.max(0, Math.round(km / KM_PER_UNIT)));
}

function getKm(units: number): number {
  return Math.round(units * KM_PER_UNIT * 10) / 10;
}

export function getCrustLayersBuffer(columns: readonly CrustColumn[]): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(MAGIC.length + columns.length * LAYERS_PER_CELL);
  bytes.set(new TextEncoder().encode(MAGIC));
  columns.forEach(({ sedimentsKm, upperKm, middleKm, lowerKm }, index) => {
    const offset = MAGIC.length + index * LAYERS_PER_CELL;
    bytes.set([sedimentsKm, upperKm, middleKm, lowerKm].map(getUnits), offset);
  });
  return bytes;
}

export function getDecodedCrustLayers(bytes: Uint8Array): CrustGrid {
  const magic = new TextDecoder().decode(bytes.subarray(0, MAGIC.length));
  if (magic !== MAGIC || bytes.length !== MAGIC.length + CRUST_CELL_COUNT * LAYERS_PER_CELL) {
    throw new Error('Not a CRUST1.0 layer file');
  }
  return { thicknesses: bytes.subarray(MAGIC.length) };
}

function getCellIndex(lat: number, lon: number): number {
  const row = Math.min(179, Math.max(0, Math.floor(90 - lat)));
  const column = ((Math.floor(lon + 180) % 360) + 360) % 360;
  return row * 360 + column;
}

export function getCrustColumn({ thicknesses }: CrustGrid, lat: number, lon: number): CrustColumn {
  const offset = getCellIndex(lat, lon) * LAYERS_PER_CELL;
  const [sedimentsKm, upperKm, middleKm, lowerKm] = Array.from(
    thicknesses.subarray(offset, offset + LAYERS_PER_CELL),
    getKm,
  );
  return { sedimentsKm, upperKm, middleKm, lowerKm };
}
