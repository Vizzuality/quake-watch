import { z } from 'zod';

import type { CrustCell, CrustCellsInput } from './types';

const COLUMNS = 360;
const ROWS = 180;
const VALUES_PER_CELL = 9;
const BYTES_PER_VALUE = 2;
const UNITS_PER_KM = 100;

export const crustCellsInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusCells: z.number().int().min(0).max(6),
});

function getRow(latitude: number): number {
  return Math.min(ROWS - 1, Math.max(0, Math.floor(90 - latitude)));
}

function getColumn(longitude: number): number {
  const column = Math.floor(longitude + 180);
  return ((column % COLUMNS) + COLUMNS) % COLUMNS;
}

function getCellAt(view: DataView, row: number, column: number): CrustCell {
  const offset = (row * COLUMNS + column) * VALUES_PER_CELL * BYTES_PER_VALUE;
  const boundaryElevationsKm = Array.from(
    { length: VALUES_PER_CELL },
    (_, index) => view.getInt16(offset + index * BYTES_PER_VALUE, true) / UNITS_PER_KM,
  );
  return { latitude: 89.5 - row, longitude: column - 179.5, boundaryElevationsKm };
}

export function getCrust1CellIndex(latitude: number, longitude: number): number {
  return getRow(latitude) * COLUMNS + getColumn(longitude);
}

export function getCrust1Cell(view: DataView, latitude: number, longitude: number): CrustCell {
  return getCellAt(view, getRow(latitude), getColumn(longitude));
}

export function getCrust1Cells(
  view: DataView,
  { latitude, longitude, radiusCells }: CrustCellsInput,
): CrustCell[] {
  const centreRow = getRow(latitude);
  const centreColumn = getColumn(longitude);
  const firstRow = Math.max(0, centreRow - radiusCells);
  const lastRow = Math.min(ROWS - 1, centreRow + radiusCells);
  const cells: CrustCell[] = [];
  for (let row = firstRow; row <= lastRow; row++) {
    for (let offset = -radiusCells; offset <= radiusCells; offset++) {
      cells.push(getCellAt(view, row, (centreColumn + offset + COLUMNS) % COLUMNS));
    }
  }
  return cells;
}
