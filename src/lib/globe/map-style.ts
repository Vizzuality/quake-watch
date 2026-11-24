import type {
  ExpressionSpecification,
  FilterSpecification,
  FontFacesSpecification,
  LayerSpecification,
  StyleSpecification,
} from 'maplibre-gl';

import { FELT_RING_LOOK } from './felt-rings';
import { TOWN_ICON_ID } from './map-images';
import { QUAKE_MARKER_LOOK } from './quakes';

export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
export const MAP_SOURCE_ID = 'openmaptiles';
export const MAP_LOW_SOURCE_ID = 'openmaptiles-low';
export const MAP_LOW_MAXZOOM = 3;
export const QUAKE_SOURCE_ID = 'quakes';
export const QUAKE_LAYER_ID = 'quakes';
export const FELT_SOURCE_ID = 'felt-rings';
export const FELT_FILL_LAYER_ID = 'felt-rings-fill';
export const FELT_LINE_LAYER_ID = 'felt-rings-line';
export const QUAKE_RING_LAYER_ID = 'quake-rings';
export const AREA_SOURCE_ID = 'area-ring';
export const AREA_LAYER_ID = 'area-ring';
export const SELECTED_LAYER_ID = 'selected-quake';
export const SELECTED_RING_LAYER_ID = 'selected-quake-ring';
export const MAP_FONTS = {
  regular: 'Space Grotesk Regular',
  medium: 'Space Grotesk Medium',
  light: 'Space Grotesk Light',
} as const;
export const MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

export const MAP_COLORS = {
  background: 'transparent',
  ocean: '#282B60',
  primary: '#E6E4F5',
  muted: '#A09DC1',
  accent: '#EB598E',
  land: '#3C3B67',
};
export const QUAKE_ZOOM_SCALES = [
  [4, 1],
  [8, 2],
  [12, 4],
  [16, 6],
] as const;
export const QUAKE_EDGE_PX = 0.5;

const MAP_LOOK = {
  coastlinePx: 0.6,
  coarseWaterMaxZoom: 8,
  areaDash: [2, 4],
  labelPx: 10,
  townPx: 11,
  townGapPx: 7,
  townOpacity: 0.85,
  countrySpacingEm: 0.32,
  seaSpacingEm: 0.3,
  countryMaxZoom: 8,
  regionMinZoom: 5,
  regionFadeZoom: 7,
  regionMaxZoom: 9,
  regionPx: 9,
  regionSpacingEm: 0.24,
  islandPx: 10,
  islandSpacingEm: 0.06,
  islandOpacity: 0.9,
  labelHaloPx: 1.5,
  neighbourhoodMinZoom: 11,
  neighbourhoodPx: 9,
  neighbourhoodSpacingEm: 0.18,
  neighbourhoodOpacity: 0.7,
  streetLabelMinZoom: 13,
  streetLabelOpacity: 0.75,
  selectedDotPx: 7.6,
  selectedRingPx: 14,
  selectedRingStrokePx: 1,
} as const;
const EMPTY_COLLECTION = { type: 'FeatureCollection' as const, features: [] };
const NAME: ExpressionSpecification = [
  'coalesce',
  ['get', 'name:en'],
  ['get', 'name:latin'],
  ['get', 'name'],
];
const POINT_FILTER: FilterSpecification = ['==', ['geometry-type'], 'Point'];
const LINE_FILTER: ExpressionSpecification = ['==', ['geometry-type'], 'LineString'];
const POLYGON_FILTER: ExpressionSpecification = ['==', ['geometry-type'], 'Polygon'];
const UNFELT_FILTER: ExpressionSpecification = ['!', ['get', 'isFelt']];
const REPLAY_BASE_FILTERS: ReadonlyArray<[string, ExpressionSpecification | null]> = [
  [QUAKE_LAYER_ID, null],
  [QUAKE_RING_LAYER_ID, UNFELT_FILTER],
  [FELT_FILL_LAYER_ID, POLYGON_FILTER],
  [FELT_LINE_LAYER_ID, LINE_FILTER],
];

type MapFontFiles = { latin: string; latinExt: string };
export type MapFontUrls = Record<keyof typeof MAP_FONTS, MapFontFiles>;
export type FeltRingPaint = {
  lineColor: ExpressionSpecification | string;
  lineOpacity: number;
  fillOpacity: number;
};

function getFontFace({ latin, latinExt }: MapFontFiles) {
  return [
    { url: latin, 'unicode-range': ['U+0-FF', 'U+131', 'U+152-153', 'U+2000-206F'] },
    { url: latinExt, 'unicode-range': ['U+100-24F', 'U+1E00-1EFF', 'U+20A0-20CF'] },
  ];
}

function getFontFaces(fontUrls: MapFontUrls): FontFacesSpecification {
  return {
    [MAP_FONTS.regular]: getFontFace(fontUrls.regular),
    [MAP_FONTS.medium]: getFontFace(fontUrls.medium),
    [MAP_FONTS.light]: getFontFace(fontUrls.light),
  };
}

function getScaledRadius(scale: number): ExpressionSpecification {
  return ['*', ['+', ['get', 'radius'], QUAKE_EDGE_PX], scale];
}

function getScaledRingRadius(scale: number): ExpressionSpecification {
  return ['+', getScaledRadius(scale), ['-', ['get', 'ringRadius'], ['get', 'radius']]];
}

function getZoomedRadius(
  getRadius: (scale: number) => ExpressionSpecification,
): ExpressionSpecification {
  const stops = QUAKE_ZOOM_SCALES.flatMap(([zoom, scale]) => [zoom, getRadius(scale)]);
  return ['interpolate', ['linear'], ['zoom'], ...stops] as ExpressionSpecification;
}

export function getSelectedQuakeFilter(key: string | null): FilterSpecification {
  return ['==', ['get', 'key'], key ?? ''];
}

function getReplayFilter(
  base: ExpressionSpecification | null,
  playhead: number | null,
): ExpressionSpecification | null {
  if (playhead === null) return base;
  const shown: ExpressionSpecification = ['<=', ['get', 'time'], playhead];
  if (base === null) return shown;
  return ['all', base, shown];
}

export function getReplayFilters(
  playhead: number | null,
): Array<[string, ExpressionSpecification | null]> {
  return REPLAY_BASE_FILTERS.map(([layerId, base]) => [layerId, getReplayFilter(base, playhead)]);
}

export function getFeltRingPaint(isSelected: boolean): FeltRingPaint {
  if (isSelected) return { lineColor: MAP_COLORS.accent, lineOpacity: 1, fillOpacity: 0 };
  return {
    lineColor: ['get', 'color'],
    lineOpacity: FELT_RING_LOOK.strokeA,
    fillOpacity: FELT_RING_LOOK.fillA,
  };
}

const ROAD_LOOK = [
  {
    id: 'road-minor',
    classes: ['minor', 'service'],
    minzoom: 12,
    opacity: 0.16,
    widths: [12, 0.5, 14, 1, 16, 3, 18, 6],
  },
  {
    id: 'road-secondary',
    classes: ['secondary', 'tertiary'],
    minzoom: 9,
    opacity: 0.24,
    widths: [9, 0.4, 12, 1, 16, 4],
  },
  {
    id: 'road-primary',
    classes: ['primary', 'trunk'],
    minzoom: 6,
    opacity: 0.32,
    widths: [6, 0.4, 10, 1, 16, 5],
  },
  {
    id: 'road-motorway',
    classes: ['motorway'],
    minzoom: 5,
    opacity: 0.4,
    widths: [5, 0.5, 10, 1.2, 16, 6],
  },
] as const;
const BOUNDARY_LOOK = [
  { id: 'boundary-state', adminLevel: 4, minzoom: 4, opacity: 0.18, widthPx: 0.6, dash: [3, 3] },
  { id: 'boundary-country', adminLevel: 2, minzoom: 0, opacity: 0.35, widthPx: 0.8, dash: null },
] as const;

function getRoadFilter(classes: readonly string[]): FilterSpecification {
  return [
    'all',
    ['==', ['geometry-type'], 'LineString'],
    ['match', ['get', 'class'], [...classes], true, false],
  ];
}

function getLandHaloPaint(textColor: string) {
  return {
    'text-color': textColor,
    'text-halo-color': MAP_COLORS.land,
    'text-halo-width': MAP_LOOK.labelHaloPx,
  };
}

function getRoadLayers(): LayerSpecification[] {
  return ROAD_LOOK.map(({ id, classes, minzoom, opacity, widths }) => ({
    id,
    type: 'line',
    source: MAP_SOURCE_ID,
    'source-layer': 'transportation',
    minzoom,
    filter: getRoadFilter(classes),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': MAP_COLORS.primary,
      'line-opacity': opacity,
      'line-width': ['interpolate', ['linear'], ['zoom'], ...widths] as ExpressionSpecification,
    },
  }));
}

function getBoundaryLayers(): LayerSpecification[] {
  return BOUNDARY_LOOK.map(({ id, adminLevel, minzoom, opacity, widthPx, dash }) => ({
    id,
    type: 'line',
    source: MAP_SOURCE_ID,
    'source-layer': 'boundary',
    minzoom,
    filter: ['all', ['==', ['get', 'admin_level'], adminLevel], ['!=', ['get', 'maritime'], 1]],
    paint: {
      'line-color': MAP_COLORS.primary,
      'line-opacity': opacity,
      'line-width': widthPx,
      ...(dash ? { 'line-dasharray': [...dash] } : {}),
    },
  }));
}

function getBaseLayers(): LayerSpecification[] {
  return [
    { id: 'background', type: 'background', paint: { 'background-color': MAP_COLORS.land } },
    {
      id: 'water-low',
      type: 'fill',
      source: MAP_LOW_SOURCE_ID,
      'source-layer': 'water',
      maxzoom: MAP_LOOK.coarseWaterMaxZoom,
      paint: { 'fill-color': MAP_COLORS.ocean, 'fill-antialias': false },
    },
    {
      id: 'water',
      type: 'fill',
      source: MAP_SOURCE_ID,
      'source-layer': 'water',
      paint: { 'fill-color': MAP_COLORS.ocean, 'fill-antialias': false },
    },
    {
      id: 'coastline',
      type: 'line',
      source: MAP_SOURCE_ID,
      'source-layer': 'water',
      paint: { 'line-color': MAP_COLORS.primary, 'line-width': MAP_LOOK.coastlinePx },
    },
    ...getBoundaryLayers(),
    ...getRoadLayers(),
  ];
}

function getQuakeLayers(): LayerSpecification[] {
  const feltPaint = getFeltRingPaint(false);
  return [
    {
      id: AREA_LAYER_ID,
      type: 'line',
      source: AREA_SOURCE_ID,
      paint: {
        'line-color': MAP_COLORS.muted,
        'line-width': 1,
        'line-dasharray': [...MAP_LOOK.areaDash],
      },
    },
    {
      id: FELT_FILL_LAYER_ID,
      type: 'fill',
      source: FELT_SOURCE_ID,
      filter: POLYGON_FILTER,
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': feltPaint.fillOpacity },
    },
    {
      id: FELT_LINE_LAYER_ID,
      type: 'line',
      source: FELT_SOURCE_ID,
      filter: LINE_FILTER,
      paint: {
        'line-color': feltPaint.lineColor,
        'line-opacity': feltPaint.lineOpacity,
        'line-width': FELT_RING_LOOK.strokePx,
      },
    },
    {
      id: QUAKE_RING_LAYER_ID,
      type: 'circle',
      source: QUAKE_SOURCE_ID,
      filter: UNFELT_FILTER,
      paint: {
        'circle-radius': getZoomedRadius(getScaledRingRadius),
        'circle-opacity': 0,
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-width': FELT_RING_LOOK.strokePx,
        'circle-stroke-opacity': FELT_RING_LOOK.hollowA,
      },
    },
    {
      id: QUAKE_LAYER_ID,
      type: 'circle',
      source: QUAKE_SOURCE_ID,
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': getZoomedRadius(getScaledRadius),
        'circle-opacity': QUAKE_MARKER_LOOK.epicentreA,
      },
    },
    {
      id: SELECTED_RING_LAYER_ID,
      type: 'circle',
      source: QUAKE_SOURCE_ID,
      filter: getSelectedQuakeFilter(null),
      paint: {
        'circle-radius': MAP_LOOK.selectedRingPx - MAP_LOOK.selectedRingStrokePx / 2,
        'circle-opacity': 0,
        'circle-stroke-color': MAP_COLORS.primary,
        'circle-stroke-width': MAP_LOOK.selectedRingStrokePx,
      },
    },
    {
      id: SELECTED_LAYER_ID,
      type: 'circle',
      source: QUAKE_SOURCE_ID,
      filter: getSelectedQuakeFilter(null),
      paint: { 'circle-color': MAP_COLORS.accent, 'circle-radius': MAP_LOOK.selectedDotPx },
    },
  ];
}

function getSeaLayout(fontSize: number) {
  return {
    'text-field': NAME,
    'text-font': [MAP_FONTS.light],
    'text-size': fontSize,
    'text-letter-spacing': MAP_LOOK.seaSpacingEm,
    'text-transform': 'uppercase' as const,
  };
}

function getLabelLayers(): LayerSpecification[] {
  const seaPaint = {
    'text-color': MAP_COLORS.muted,
    'text-halo-color': MAP_COLORS.ocean,
    'text-halo-width': MAP_LOOK.labelHaloPx,
  };
  return [
    {
      id: 'label-road',
      type: 'symbol',
      source: MAP_SOURCE_ID,
      'source-layer': 'transportation_name',
      minzoom: MAP_LOOK.streetLabelMinZoom,
      filter: LINE_FILTER,
      layout: {
        'symbol-placement': 'line',
        'text-field': NAME,
        'text-font': [MAP_FONTS.regular],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 16, 12],
      },
      paint: {
        ...getLandHaloPaint(MAP_COLORS.primary),
        'text-opacity': MAP_LOOK.streetLabelOpacity,
      },
    },
    {
      id: 'label-sea-line',
      type: 'symbol',
      source: MAP_SOURCE_ID,
      'source-layer': 'water_name',
      filter: LINE_FILTER,
      layout: { ...getSeaLayout(MAP_LOOK.labelPx), 'symbol-placement': 'line' },
      paint: seaPaint,
    },
    {
      id: 'label-sea',
      type: 'symbol',
      source: MAP_SOURCE_ID,
      'source-layer': 'water_name',
      filter: POINT_FILTER,
      layout: getSeaLayout(MAP_LOOK.labelPx),
      paint: seaPaint,
    },
    {
      id: 'label-island',
      type: 'symbol',
      source: MAP_SOURCE_ID,
      'source-layer': 'place',
      filter: ['==', ['get', 'class'], 'island'],
      layout: {
        'symbol-sort-key': ['get', 'rank'],
        'text-field': NAME,
        'text-font': [MAP_FONTS.regular],
        'text-size': MAP_LOOK.islandPx,
        'text-letter-spacing': MAP_LOOK.islandSpacingEm,
      },
      paint: { ...getLandHaloPaint(MAP_COLORS.muted), 'text-opacity': MAP_LOOK.islandOpacity },
    },
    {
      id: 'label-region',
      type: 'symbol',
      source: MAP_SOURCE_ID,
      'source-layer': 'place',
      minzoom: MAP_LOOK.regionMinZoom,
      maxzoom: MAP_LOOK.regionMaxZoom,
      filter: ['match', ['get', 'class'], ['state', 'province'], true, false],
      layout: {
        'symbol-sort-key': ['get', 'rank'],
        'text-field': NAME,
        'text-font': [MAP_FONTS.medium],
        'text-size': MAP_LOOK.regionPx,
        'text-letter-spacing': MAP_LOOK.regionSpacingEm,
        'text-transform': 'uppercase',
      },
      paint: {
        ...getLandHaloPaint(MAP_COLORS.muted),
        'text-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          MAP_LOOK.regionFadeZoom,
          1,
          MAP_LOOK.regionMaxZoom,
          0,
        ],
      },
    },
    {
      id: 'label-neighbourhood',
      type: 'symbol',
      source: MAP_SOURCE_ID,
      'source-layer': 'place',
      minzoom: MAP_LOOK.neighbourhoodMinZoom,
      filter: ['match', ['get', 'class'], ['suburb', 'quarter', 'neighbourhood'], true, false],
      layout: {
        'text-field': NAME,
        'text-font': [MAP_FONTS.medium],
        'text-size': MAP_LOOK.neighbourhoodPx,
        'text-letter-spacing': MAP_LOOK.neighbourhoodSpacingEm,
        'text-transform': 'uppercase',
      },
      paint: {
        ...getLandHaloPaint(MAP_COLORS.primary),
        'text-opacity': MAP_LOOK.neighbourhoodOpacity,
      },
    },
    {
      id: 'label-town',
      type: 'symbol',
      source: MAP_SOURCE_ID,
      'source-layer': 'place',
      filter: ['match', ['get', 'class'], ['city', 'town', 'village', 'hamlet'], true, false],
      layout: {
        'symbol-sort-key': ['get', 'rank'],
        'icon-image': TOWN_ICON_ID,
        'text-field': NAME,
        'text-font': [MAP_FONTS.regular],
        'text-size': MAP_LOOK.townPx,
        'text-anchor': 'left',
        'text-justify': 'left',
        'text-offset': [MAP_LOOK.townGapPx / MAP_LOOK.townPx, 0],
      },
      paint: { ...getLandHaloPaint(MAP_COLORS.primary), 'text-opacity': MAP_LOOK.townOpacity },
    },
    {
      id: 'label-country',
      type: 'symbol',
      source: MAP_SOURCE_ID,
      'source-layer': 'place',
      maxzoom: MAP_LOOK.countryMaxZoom,
      filter: ['==', ['get', 'class'], 'country'],
      layout: {
        'symbol-sort-key': ['get', 'rank'],
        'text-field': NAME,
        'text-font': [MAP_FONTS.medium],
        'text-size': MAP_LOOK.labelPx,
        'text-letter-spacing': MAP_LOOK.countrySpacingEm,
        'text-transform': 'uppercase',
      },
      paint: getLandHaloPaint(MAP_COLORS.primary),
    },
  ];
}

export function getQuakeMapStyle(
  dark: StyleSpecification,
  fontUrls: MapFontUrls,
): StyleSpecification {
  const source = dark.sources[MAP_SOURCE_ID];
  return {
    version: 8,
    'font-faces': getFontFaces(fontUrls),
    sources: {
      [MAP_SOURCE_ID]: source,
      [MAP_LOW_SOURCE_ID]: { ...source, maxzoom: MAP_LOW_MAXZOOM } as typeof source,
      [AREA_SOURCE_ID]: { type: 'geojson', data: EMPTY_COLLECTION },
      [FELT_SOURCE_ID]: { type: 'geojson', data: EMPTY_COLLECTION },
      [QUAKE_SOURCE_ID]: { type: 'geojson', data: EMPTY_COLLECTION },
    },
    layers: [...getBaseLayers(), ...getQuakeLayers(), ...getLabelLayers()],
  };
}
