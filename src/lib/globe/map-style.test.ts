import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';

import { FELT_RING_LOOK } from './felt-rings';
import { LABEL_OBSTACLE_ICON_ID } from './label-obstacles';
import { TOWN_ICON_ID } from './map-images';
import {
  AREA_LAYER_ID,
  AREA_SOURCE_ID,
  FELT_FILL_LAYER_ID,
  FELT_LINE_LAYER_ID,
  LABEL_OBSTACLE_LAYER_ID,
  LABEL_OBSTACLE_SOURCE_ID,
  MAP_COLORS,
  MAP_FONTS,
  QUAKE_LAYER_ID,
  QUAKE_RING_LAYER_ID,
  SEARCH_AREA_CENTRE_LAYER_ID,
  SEARCH_AREA_LINE_LAYER_ID,
  SEARCH_AREA_SOURCE_ID,
  SELECTED_LAYER_ID,
  SELECTED_RING_LAYER_ID,
  getFeltRingPaint,
  getQuakeMapStyle,
  getReplayFilters,
  getSelectedQuakeFilter,
} from './map-style';
import { QUAKE_MARKER_LOOK } from './quakes';

const FONT_URLS = {
  regular: { latin: 'regular.woff2', latinExt: 'regular-ext.woff2' },
  medium: { latin: 'medium.woff2', latinExt: 'medium-ext.woff2' },
  light: { latin: 'light.woff2', latinExt: 'light-ext.woff2' },
};

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
      id: 'highway_minor',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      paint: { 'line-color': '#181818', 'line-width': 2 },
    },
    {
      id: 'place_city',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'] },
    },
  ] as LayerSpecification[],
};

const style = getQuakeMapStyle(DARK, FONT_URLS);

function getLayer(id: string) {
  const layer = style.layers.find((candidate) => candidate.id === id);
  if (!layer) throw new Error(`No layer ${id}`);
  return layer;
}

describe('getQuakeMapStyle', () => {
  it('draws plain land and sea, the streets and boundaries, the quakes and the QW labels', () => {
    expect(style.layers.map(({ id }) => id)).toEqual([
      'background',
      'water-low',
      'water',
      'coastline',
      'boundary-state',
      'boundary-country',
      'road-minor',
      'road-secondary',
      'road-primary',
      'road-motorway',
      SEARCH_AREA_LINE_LAYER_ID,
      SEARCH_AREA_CENTRE_LAYER_ID,
      AREA_LAYER_ID,
      FELT_FILL_LAYER_ID,
      FELT_LINE_LAYER_ID,
      QUAKE_RING_LAYER_ID,
      QUAKE_LAYER_ID,
      SELECTED_RING_LAYER_ID,
      SELECTED_LAYER_ID,
      'label-road',
      'label-sea-line',
      'label-sea',
      'label-island',
      'label-region',
      'label-neighbourhood',
      'label-town',
      'label-country',
      LABEL_OBSTACLE_LAYER_ID,
    ]);
  });

  it('places the UI chrome blockers first and always, so no label lands under the chrome', () => {
    expect(style.sources[LABEL_OBSTACLE_SOURCE_ID]).toMatchObject({ type: 'geojson' });
    expect(getLayer(LABEL_OBSTACLE_LAYER_ID)).toMatchObject({
      type: 'symbol',
      source: LABEL_OBSTACLE_SOURCE_ID,
      layout: {
        'icon-image': LABEL_OBSTACLE_ICON_ID,
        'icon-size': ['get', 'iconSize'],
        'icon-padding': 0,
        'icon-allow-overlap': true,
      },
    });
    expect(getLayer(LABEL_OBSTACLE_LAYER_ID).layout).not.toHaveProperty('icon-ignore-placement');
  });

  it('fills the land flat and the water in the ocean colour, with no dot grid at any zoom', () => {
    expect(getLayer('background').paint).toEqual({ 'background-color': MAP_COLORS.land });
    expect(getLayer('water').paint).toEqual({
      'fill-color': MAP_COLORS.ocean,
      'fill-antialias': false,
    });
    const paints = style.layers.map((layer) => JSON.stringify(layer.paint ?? {}));
    expect(paints.some((paint) => paint.includes('pattern'))).toBe(false);
  });

  it('draws roads as thin primary lines, minor streets only once zoomed in to street level', () => {
    expect(getLayer('road-minor')).toMatchObject({
      'source-layer': 'transportation',
      minzoom: 12,
      filter: [
        'all',
        ['==', ['geometry-type'], 'LineString'],
        ['match', ['get', 'class'], ['minor', 'service'], true, false],
      ],
      paint: { 'line-color': MAP_COLORS.primary, 'line-opacity': 0.16 },
    });
    expect(getLayer('road-motorway')).toMatchObject({
      minzoom: 5,
      paint: { 'line-color': MAP_COLORS.primary, 'line-opacity': 0.4 },
    });
  });

  it('draws land boundaries subtly and never the maritime ones', () => {
    expect(getLayer('boundary-country')).toMatchObject({
      'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
      paint: { 'line-opacity': 0.35, 'line-width': 0.8 },
    });
    expect(getLayer('boundary-state')).toMatchObject({
      paint: { 'line-opacity': 0.18, 'line-dasharray': [3, 3] },
    });
  });

  it('names streets along their line from zoom 13, haloed in the land colour', () => {
    expect(getLayer('label-road')).toMatchObject({
      'source-layer': 'transportation_name',
      minzoom: 13,
      layout: { 'symbol-placement': 'line', 'text-font': [MAP_FONTS.regular] },
      paint: {
        'text-color': MAP_COLORS.primary,
        'text-halo-color': MAP_COLORS.land,
        'text-halo-width': 1.5,
      },
    });
  });

  it('names suburbs and neighbourhoods from zoom 11 in QW/Label S', () => {
    expect(getLayer('label-neighbourhood')).toMatchObject({
      minzoom: 11,
      filter: ['match', ['get', 'class'], ['suburb', 'quarter', 'neighbourhood'], true, false],
      layout: {
        'text-font': [MAP_FONTS.medium],
        'text-size': 9,
        'text-letter-spacing': 0.18,
        'text-transform': 'uppercase',
      },
      paint: { 'text-halo-color': MAP_COLORS.land },
    });
  });

  it('outlines only the sea coast with a 0.6 px primary line, leaving lakes, reservoirs and rivers unstroked', () => {
    expect(getLayer('coastline')).toMatchObject({
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'water',
      filter: ['==', ['get', 'class'], 'ocean'],
      paint: { 'line-color': MAP_COLORS.primary, 'line-width': 0.6 },
    });
  });

  it('keeps z4 coarse water under the map while zoomed out so fast moves show coasts, not straight-edged wedges', () => {
    expect(style.sources['openmaptiles-low']).toEqual({
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      maxzoom: 4,
    });
    expect(getLayer('water-low')).toMatchObject({
      source: 'openmaptiles-low',
      'source-layer': 'water',
      paint: { 'fill-color': MAP_COLORS.ocean },
    });
  });

  it('drops the coarse water once its tiles would be overzoomed past the detailed coastline', () => {
    expect(getLayer('water-low')).toMatchObject({ maxzoom: 5 });
  });

  it('serves the three label weights from our own files and never from the OpenFreeMap glyphs', () => {
    expect(style['font-faces']).toEqual({
      [MAP_FONTS.regular]: expect.arrayContaining([
        expect.objectContaining({ url: 'regular.woff2' }),
      ]),
      [MAP_FONTS.medium]: expect.arrayContaining([
        expect.objectContaining({ url: 'medium.woff2' }),
      ]),
      [MAP_FONTS.light]: expect.arrayContaining([expect.objectContaining({ url: 'light.woff2' })]),
    });
    expect(style.glyphs).toBeUndefined();
    expect(style.sprite).toBeUndefined();
    expect(Object.keys(style.sources)).toEqual([
      'openmaptiles',
      'openmaptiles-low',
      SEARCH_AREA_SOURCE_ID,
      AREA_SOURCE_ID,
      'felt-rings',
      'quakes',
      LABEL_OBSTACLE_SOURCE_ID,
    ]);
  });

  it('sets countries in QW/Country: 10 px medium, 3.2 px tracking, uppercase, primary', () => {
    expect(getLayer('label-country')).toMatchObject({
      filter: ['==', ['get', 'class'], 'country'],
      layout: {
        'text-font': [MAP_FONTS.medium],
        'text-size': 10,
        'text-letter-spacing': 0.32,
        'text-transform': 'uppercase',
      },
      paint: { 'text-color': MAP_COLORS.primary, 'text-halo-color': MAP_COLORS.land },
    });
  });

  it('sets seas in QW/Sea: 10 px light, 3 px tracking, uppercase, muted', () => {
    for (const id of ['label-sea', 'label-sea-line']) {
      expect(getLayer(id)).toMatchObject({
        'source-layer': 'water_name',
        layout: {
          'text-font': [MAP_FONTS.light],
          'text-size': 10,
          'text-letter-spacing': 0.3,
          'text-transform': 'uppercase',
        },
        paint: { 'text-color': MAP_COLORS.muted, 'text-halo-color': MAP_COLORS.ocean },
      });
    }
  });

  it('names states and provinces from zoom 5 in muted spaced uppercase, fading out by zoom 9', () => {
    expect(getLayer('label-region')).toMatchObject({
      'source-layer': 'place',
      minzoom: 5,
      maxzoom: 9,
      filter: ['match', ['get', 'class'], ['state', 'province'], true, false],
      layout: {
        'symbol-sort-key': ['get', 'rank'],
        'text-font': [MAP_FONTS.medium],
        'text-size': 9,
        'text-letter-spacing': 0.24,
        'text-transform': 'uppercase',
      },
      paint: {
        'text-color': MAP_COLORS.muted,
        'text-halo-color': MAP_COLORS.land,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 9, 0],
      },
    });
  });

  it('names islands in muted mixed case, largest first', () => {
    const island = getLayer('label-island');
    expect(island).toMatchObject({
      'source-layer': 'place',
      filter: ['==', ['get', 'class'], 'island'],
      layout: {
        'symbol-sort-key': ['get', 'rank'],
        'text-font': [MAP_FONTS.regular],
        'text-size': 10,
        'text-letter-spacing': 0.06,
      },
      paint: {
        'text-color': MAP_COLORS.muted,
        'text-halo-color': MAP_COLORS.land,
        'text-opacity': 0.9,
      },
    });
    expect(island.layout).not.toHaveProperty('text-transform');
  });

  it('places towns and countries above regions and islands so collisions keep them', () => {
    const ids = style.layers.map(({ id }) => id);
    for (const area of ['label-region', 'label-island']) {
      expect(ids.indexOf(area)).toBeLessThan(ids.indexOf('label-town'));
      expect(ids.indexOf(area)).toBeLessThan(ids.indexOf('label-country'));
    }
  });

  it('sets towns in QW/Place at 85% with a 4 px ring 5 px before the name', () => {
    expect(getLayer('label-town')).toMatchObject({
      layout: {
        'icon-image': TOWN_ICON_ID,
        'text-font': [MAP_FONTS.regular],
        'text-size': 11,
        'text-anchor': 'left',
        'text-offset': [7 / 11, 0],
      },
      paint: {
        'text-color': MAP_COLORS.primary,
        'text-opacity': 0.85,
        'text-halo-color': MAP_COLORS.land,
      },
    });
  });

  it('reads Latin names only', () => {
    const country = getLayer('label-country');
    if (country.type !== 'symbol') throw new Error('Not a symbol layer');
    expect(country.layout?.['text-field']).toEqual([
      'coalesce',
      ['get', 'name:en'],
      ['get', 'name:latin'],
      ['get', 'name'],
    ]);
  });

  it('dashes the 300 km area ring 2 on 4 in the muted colour', () => {
    expect(getLayer(AREA_LAYER_ID)).toMatchObject({
      source: AREA_SOURCE_ID,
      paint: { 'line-color': MAP_COLORS.muted, 'line-width': 1, 'line-dasharray': [2, 4] },
    });
  });

  it('outlines the searched area in a thin primary line and dots its centre', () => {
    expect(getLayer(SEARCH_AREA_LINE_LAYER_ID)).toMatchObject({
      source: SEARCH_AREA_SOURCE_ID,
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: { 'line-color': MAP_COLORS.primary, 'line-opacity': 0.5, 'line-width': 1 },
    });
    expect(getLayer(SEARCH_AREA_CENTRE_LAYER_ID)).toMatchObject({
      source: SEARCH_AREA_SOURCE_ID,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: { 'circle-color': MAP_COLORS.primary, 'circle-opacity': 0.9, 'circle-radius': 2.5 },
    });
  });

  it('paints felt rings like the globe does until a quake is selected', () => {
    expect(getLayer(FELT_FILL_LAYER_ID)).toMatchObject({
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': FELT_RING_LOOK.fillA },
    });
    expect(getLayer(FELT_LINE_LAYER_ID)).toMatchObject({
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: {
        'line-color': ['get', 'color'],
        'line-opacity': FELT_RING_LOOK.strokeA,
        'line-width': FELT_RING_LOOK.strokePx,
      },
    });
  });

  it('draws epicentres as the globe does at the handover and grows them as the map zooms in', () => {
    const epicentre = ['+', ['get', 'radius'], 0.5];
    expect(getLayer(QUAKE_LAYER_ID).paint).toMatchObject({
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        4,
        ['*', epicentre, 1],
        8,
        ['*', epicentre, 2],
        12,
        ['*', epicentre, 4],
        16,
        ['*', epicentre, 6],
      ],
      'circle-opacity': QUAKE_MARKER_LOOK.epicentreA,
    });
  });

  it('keeps each hollow ring the same gap outside its growing epicentre', () => {
    const gap = ['-', ['get', 'ringRadius'], ['get', 'radius']];
    const epicentre = ['+', ['get', 'radius'], 0.5];
    expect(getLayer(QUAKE_RING_LAYER_ID)).toMatchObject({
      filter: ['!', ['get', 'isFelt']],
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          4,
          ['+', ['*', epicentre, 1], gap],
          8,
          ['+', ['*', epicentre, 2], gap],
          12,
          ['+', ['*', epicentre, 4], gap],
          16,
          ['+', ['*', epicentre, 6], gap],
        ],
        'circle-opacity': 0,
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-width': FELT_RING_LOOK.strokePx,
        'circle-stroke-opacity': FELT_RING_LOOK.hollowA,
      },
    });
  });

  it('marks the selected quake with a 7.6 px pink dot inside a 14 px primary ring', () => {
    expect(getLayer(SELECTED_LAYER_ID)).toMatchObject({
      source: 'quakes',
      filter: getSelectedQuakeFilter(null),
      paint: { 'circle-color': MAP_COLORS.accent, 'circle-radius': 7.6 },
    });
    expect(getLayer(SELECTED_RING_LAYER_ID)).toMatchObject({
      source: 'quakes',
      filter: getSelectedQuakeFilter(null),
      paint: {
        'circle-radius': 13.5,
        'circle-opacity': 0,
        'circle-stroke-color': MAP_COLORS.primary,
        'circle-stroke-width': 1,
      },
    });
  });
});

describe('getSelectedQuakeFilter', () => {
  it('matches only the selected quake, and nothing without a selection', () => {
    expect(getSelectedQuakeFilter('emsc:1')).toEqual(['==', ['get', 'key'], 'emsc:1']);
    expect(getSelectedQuakeFilter(null)).toEqual(['==', ['get', 'key'], '']);
  });
});

describe('getReplayFilters', () => {
  const REPLAY_LAYER_IDS = [
    QUAKE_LAYER_ID,
    QUAKE_RING_LAYER_ID,
    FELT_FILL_LAYER_ID,
    FELT_LINE_LAYER_ID,
  ];

  function getStyleFilter(id: string) {
    const layer = getLayer(id);
    return 'filter' in layer ? (layer.filter ?? null) : null;
  }

  it('restores the style filters when live', () => {
    expect(getReplayFilters(null)).toEqual(REPLAY_LAYER_IDS.map((id) => [id, getStyleFilter(id)]));
  });

  it('keeps only Earthquakes up to the playhead on top of the style filters', () => {
    const shown = ['<=', ['get', 'time'], 1000];

    expect(getReplayFilters(1000)).toEqual([
      [QUAKE_LAYER_ID, shown],
      [QUAKE_RING_LAYER_ID, ['all', getStyleFilter(QUAKE_RING_LAYER_ID), shown]],
      [FELT_FILL_LAYER_ID, ['all', getStyleFilter(FELT_FILL_LAYER_ID), shown]],
      [FELT_LINE_LAYER_ID, ['all', getStyleFilter(FELT_LINE_LAYER_ID), shown]],
    ]);
  });
});

describe('getFeltRingPaint', () => {
  it('outlines the selected quake felt reach in a 1 px pink line with no fill', () => {
    expect(getFeltRingPaint(true)).toEqual({
      lineColor: MAP_COLORS.accent,
      lineOpacity: 1,
      fillOpacity: 0,
    });
  });

  it('keeps the depth colours of the globe without a selection', () => {
    expect(getFeltRingPaint(false)).toEqual({
      lineColor: ['get', 'color'],
      lineOpacity: FELT_RING_LOOK.strokeA,
      fillOpacity: FELT_RING_LOOK.fillA,
    });
  });
});
