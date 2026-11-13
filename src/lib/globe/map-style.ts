import type {
  ExpressionSpecification,
  FontFacesSpecification,
  LayerSpecification,
  StyleSpecification,
} from 'maplibre-gl';

import { FELT_RING_LOOK } from './felt-rings';

export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
export const MAP_SOURCE_ID = 'openmaptiles';
export const MAP_LOW_SOURCE_ID = 'openmaptiles-low';
export const MAP_LOW_MAXZOOM = 0;
export const QUAKE_SOURCE_ID = 'quakes';
export const QUAKE_LAYER_ID = 'quakes';
export const FELT_SOURCE_ID = 'felt-rings';
export const FELT_FILL_LAYER_ID = 'felt-rings-fill';
export const FELT_LINE_LAYER_ID = 'felt-rings-line';
export const MAP_FONT = 'Space Grotesk Regular';
export const MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

export const MAP_COLORS = {
  background: '#05050B',
  road: '#23253F',
  boundary: '#FFFFFF',
  label: '#9A9CC0',
};
export const BOUNDARY_OPACITY = 0.25;
const QUAKE_OPACITY = 0.8;
const EMPTY_COLLECTION = { type: 'FeatureCollection' as const, features: [] };
const NAME: ExpressionSpecification = [
  'coalesce',
  ['get', 'name:en'],
  ['get', 'name:latin'],
  ['get', 'name'],
];

export type MapFontUrls = { latin: string; latinExt: string };

function getFontFaces({ latin, latinExt }: MapFontUrls): FontFacesSpecification {
  return {
    [MAP_FONT]: [
      { url: latin, 'unicode-range': ['U+0-FF', 'U+131', 'U+152-153', 'U+2000-206F'] },
      { url: latinExt, 'unicode-range': ['U+100-24F', 'U+1E00-1EFF', 'U+20A0-20CF'] },
    ],
  };
}

function getTextField(textField: unknown) {
  return JSON.stringify(textField).includes('"name') ? NAME : textField;
}

function getStreetLayer(layer: LayerSpecification): LayerSpecification {
  if (layer.type === 'background') {
    return { ...layer, paint: { ...layer.paint, 'background-color': MAP_COLORS.background } };
  }
  if (layer.type === 'line' && layer['source-layer'] === 'transportation') {
    return { ...layer, paint: { ...layer.paint, 'line-color': MAP_COLORS.road } };
  }
  if (layer.type === 'line' && layer['source-layer'] === 'boundary') {
    return {
      ...layer,
      paint: {
        ...layer.paint,
        'line-color': MAP_COLORS.boundary,
        'line-opacity': BOUNDARY_OPACITY,
      },
    };
  }
  if (layer.type !== 'symbol' || layer.layout?.['text-field'] === undefined) return layer;
  return {
    ...layer,
    layout: {
      ...layer.layout,
      'text-field': getTextField(layer.layout['text-field']) as ExpressionSpecification,
      'text-font': [MAP_FONT],
    },
    paint: {
      ...layer.paint,
      'text-color': MAP_COLORS.label,
      'text-halo-color': MAP_COLORS.background,
    },
  };
}

function getLowResolutionLayers(layers: LayerSpecification[]): LayerSpecification[] {
  return layers.flatMap((layer) =>
    layer.type === 'fill' && layer['source-layer'] === 'water'
      ? [{ ...layer, id: `${layer.id}-low`, source: MAP_LOW_SOURCE_ID }]
      : [],
  );
}

export function getStreetMapStyle(
  dark: StyleSpecification,
  fontUrls: MapFontUrls,
): StyleSpecification {
  const streetLayers = dark.layers.map(getStreetLayer);
  const [background, ...rest] = streetLayers;
  const layers = [background, ...getLowResolutionLayers(rest), ...rest];
  const quakesIndex = layers.findLastIndex((layer) => layer.type !== 'symbol') + 1;
  const quakes: LayerSpecification = {
    id: QUAKE_LAYER_ID,
    type: 'circle',
    source: QUAKE_SOURCE_ID,
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': ['get', 'radius'],
      'circle-opacity': QUAKE_OPACITY,
    },
  };
  const feltRings: LayerSpecification[] = [
    {
      id: FELT_FILL_LAYER_ID,
      type: 'fill',
      source: FELT_SOURCE_ID,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': FELT_RING_LOOK.fillA },
    },
    {
      id: FELT_LINE_LAYER_ID,
      type: 'line',
      source: FELT_SOURCE_ID,
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: {
        'line-color': ['get', 'color'],
        'line-opacity': FELT_RING_LOOK.strokeA,
        'line-width': FELT_RING_LOOK.strokePx,
      },
    },
  ];
  const { glyphs: _glyphs, ...style } = dark;
  const source = dark.sources[MAP_SOURCE_ID];
  return {
    ...style,
    'font-faces': getFontFaces(fontUrls),
    sources: {
      [MAP_SOURCE_ID]: source,
      [MAP_LOW_SOURCE_ID]: { ...source, maxzoom: MAP_LOW_MAXZOOM } as typeof source,
      [FELT_SOURCE_ID]: { type: 'geojson', data: EMPTY_COLLECTION },
      [QUAKE_SOURCE_ID]: { type: 'geojson', data: EMPTY_COLLECTION },
    },
    layers: [...layers.slice(0, quakesIndex), ...feltRings, quakes, ...layers.slice(quakesIndex)],
  };
}
