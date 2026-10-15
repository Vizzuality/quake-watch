import {
  type BandKind,
  type ColorStop,
  getRampColor,
  getRgb,
  type MantleBandKind,
  type RGB,
} from '@/lib/crust/scene';

export const CRUST_PALETTE: Record<BandKind, string> = {
  water: '#3f86c4',
  ice: '#e4eef2',
  'upper-sediments': '#ead7a0',
  'middle-sediments': '#d9bc7c',
  'lower-sediments': '#c39f62',
  'upper-crust': '#a77c54',
  'middle-crust': '#8a603f',
  'lower-crust': '#6c4530',
  'upper-mantle': '#eda53b',
  'transition-zone': '#d9672a',
  'lower-mantle': '#ad301d',
};

export const WATER_OPACITY = 0.42;

const MANTLE_RAMPS: Record<MantleBandKind, readonly ColorStop[]> = {
  'upper-mantle': [
    { value: 0, color: getRgb('#f6c453') },
    { value: 400, color: getRgb('#e88f31') },
  ],
  'transition-zone': [
    { value: 400, color: getRgb('#de7029') },
    { value: 670, color: getRgb('#c94e24') },
  ],
  'lower-mantle': [
    { value: 670, color: getRgb('#b3361f') },
    { value: 2000, color: getRgb('#7f1d12') },
  ],
};

const TERRAIN_RAMP: readonly ColorStop[] = [
  { value: -8000, color: getRgb('#122a40') },
  { value: -4000, color: getRgb('#1d4262') },
  { value: -1000, color: getRgb('#2f6588') },
  { value: -1, color: getRgb('#6d9fb8') },
  { value: 0, color: getRgb('#6e8f58') },
  { value: 400, color: getRgb('#87a061') },
  { value: 1000, color: getRgb('#ae9f6b') },
  { value: 2000, color: getRgb('#977656') },
  { value: 3500, color: getRgb('#87786c') },
  { value: 5000, color: getRgb('#d5d0c7') },
  { value: 6000, color: getRgb('#f3f1ec') },
];

const SOLID_COLORS = Object.fromEntries(
  Object.entries(CRUST_PALETTE).map(([kind, hex]) => [kind, getRgb(hex)]),
) as Record<BandKind, RGB>;

function isMantleBand(kind: BandKind): kind is MantleBandKind {
  return kind in MANTLE_RAMPS;
}

export function getBandColor(kind: BandKind, depthKm: number): RGB {
  if (isMantleBand(kind)) return getRampColor(MANTLE_RAMPS[kind], depthKm);
  return SOLID_COLORS[kind];
}

export function getTerrainColor(elevationM: number): RGB {
  return getRampColor(TERRAIN_RAMP, elevationM);
}
