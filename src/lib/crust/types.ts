export const CRUST_LAYER_KINDS = [
  'water',
  'ice',
  'upper-sediments',
  'middle-sediments',
  'lower-sediments',
  'upper-crust',
  'middle-crust',
  'lower-crust',
] as const;

export type CrustLayerKind = (typeof CRUST_LAYER_KINDS)[number];

export type CrustCell = {
  latitude: number;
  longitude: number;
  boundaryElevationsKm: readonly number[];
};

export type CrustCellsInput = {
  latitude: number;
  longitude: number;
  radiusCells: number;
};
