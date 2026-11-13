import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';

import { FELT_RING_LOOK } from './felt-rings';
import {
  BOUNDARY_OPACITY,
  FELT_FILL_LAYER_ID,
  FELT_LINE_LAYER_ID,
  MAP_COLORS,
  MAP_FONT,
  QUAKE_LAYER_ID,
  getStreetMapStyle,
} from './map-style';

const FONT_URLS = { latin: 'regular.woff2', latinExt: 'regular-ext.woff2' };
const NONLATIN_NAME = ['case', ['has', 'name:nonlatin'], ['get', 'name:nonlatin'], ['get', 'name']];

const DARK: StyleSpecification = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sprite: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
  sources: {
    openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
    ne2_shaded: { type: 'raster', tiles: ['https://example.org/{z}/{x}/{y}.png'] },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': 'rgb(12,12,12)' } },
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: { 'fill-color': 'rgb(27,27,29)' },
    },
    {
      id: 'water_name',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'water_name',
      layout: { 'text-field': NONLATIN_NAME, 'text-font': ['Noto Sans Regular'] },
    },
    {
      id: 'highway_minor',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      paint: { 'line-color': '#181818', 'line-width': 2 },
    },
    {
      id: 'road_oneway',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      layout: { 'icon-image': 'arrow' },
    },
    {
      id: 'highway_name_motorway',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      layout: { 'text-field': ['to-string', ['get', 'ref']], 'text-font': ['Noto Sans Regular'] },
    },
    {
      id: 'boundary_state',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      paint: { 'line-color': 'hsl(0,0%,21%)', 'line-opacity': 1 },
    },
    {
      id: 'place_city',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      layout: { 'text-field': NONLATIN_NAME, 'text-font': ['Noto Sans Regular'] },
      paint: { 'text-color': 'rgb(101,101,101)', 'text-halo-color': 'rgba(0,0,0,0.7)' },
    },
  ] as LayerSpecification[],
};

const style = getStreetMapStyle(DARK, FONT_URLS);

function getLayer(id: string) {
  const layer = style.layers.find((candidate) => candidate.id === id);
  if (!layer) throw new Error(`No layer ${id}`);
  return layer;
}

describe('getStreetMapStyle', () => {
  it('paints the background in the app background colour', () => {
    expect(getLayer('background').paint).toEqual({ 'background-color': MAP_COLORS.background });
  });

  it('paints roads and boundaries in the app colours', () => {
    expect(getLayer('highway_minor').paint).toEqual({
      'line-color': MAP_COLORS.road,
      'line-width': 2,
    });
    expect(getLayer('boundary_state').paint).toEqual({
      'line-color': MAP_COLORS.boundary,
      'line-opacity': BOUNDARY_OPACITY,
    });
  });

  it('sets every label in Space Grotesk and the muted colour, with Latin names only', () => {
    for (const id of ['water_name', 'highway_name_motorway', 'place_city']) {
      const layer = getLayer(id);
      if (layer.type !== 'symbol') throw new Error(`${id} is not a symbol layer`);
      expect(layer.layout?.['text-font']).toEqual([MAP_FONT]);
      expect(layer.paint?.['text-color']).toBe(MAP_COLORS.label);
      expect(layer.paint?.['text-halo-color']).toBe(MAP_COLORS.background);
    }
    const city = getLayer('place_city');
    const motorway = getLayer('highway_name_motorway');
    if (city.type !== 'symbol' || motorway.type !== 'symbol') throw new Error('Not symbol layers');
    expect(city.layout?.['text-field']).toEqual([
      'coalesce',
      ['get', 'name:en'],
      ['get', 'name:latin'],
      ['get', 'name'],
    ]);
    expect(motorway.layout?.['text-field']).toEqual(['to-string', ['get', 'ref']]);
  });

  it('leaves icon-only symbols alone', () => {
    expect(getLayer('road_oneway')).toEqual(DARK.layers[4]);
  });

  it('serves the label font from our own files and never from the OpenFreeMap glyphs', () => {
    expect(Object.keys(style['font-faces'] ?? {})).toEqual([MAP_FONT]);
    expect(style.glyphs).toBeUndefined();
    expect(Object.keys(style.sources)).toEqual([
      'openmaptiles',
      'openmaptiles-low',
      'felt-rings',
      'quakes',
    ]);
  });

  it('keeps coarse water under every layer so fast pans never show empty tiles', () => {
    expect(style.sources['openmaptiles-low']).toEqual({
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      maxzoom: 0,
    });
    expect(style.layers.slice(0, 3).map((layer) => layer.id)).toEqual([
      'background',
      'water-low',
      'water',
    ]);
    expect(getLayer('water-low')).toMatchObject({
      source: 'openmaptiles-low',
      'source-layer': 'water',
    });
  });

  it('paints felt rings like the globe does', () => {
    expect(getLayer(FELT_FILL_LAYER_ID)).toMatchObject({
      filter: ['==', ['geometry-type'], 'Polygon'],
    });
    expect(getLayer(FELT_LINE_LAYER_ID)).toMatchObject({
      filter: ['==', ['geometry-type'], 'LineString'],
    });
    expect(getLayer(FELT_FILL_LAYER_ID).paint).toEqual({
      'fill-color': ['get', 'color'],
      'fill-opacity': FELT_RING_LOOK.fillA,
    });
    expect(getLayer(FELT_LINE_LAYER_ID).paint).toEqual({
      'line-color': ['get', 'color'],
      'line-opacity': FELT_RING_LOOK.strokeA,
      'line-width': FELT_RING_LOOK.strokePx,
    });
  });

  it('draws felt rings and then quakes over the last line or fill layer', () => {
    const ids = style.layers.map((layer) => layer.id);
    expect(ids.slice(ids.indexOf('boundary_state') + 1, ids.indexOf(QUAKE_LAYER_ID) + 1)).toEqual([
      FELT_FILL_LAYER_ID,
      FELT_LINE_LAYER_ID,
      QUAKE_LAYER_ID,
    ]);
    expect(getLayer(QUAKE_LAYER_ID).paint).toMatchObject({ 'circle-opacity': 0.8 });
  });
});
