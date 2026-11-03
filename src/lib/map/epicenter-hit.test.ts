import { LngLat, Point } from 'maplibre-gl';
import type { MapGeoJSONFeature, PointLike } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';

import {
  EPICENTER_TAP_RADIUS_PX,
  getIsEpicenterVisible,
  getVisibleEpicenterId,
  getWrappedLongitude,
} from './epicenter-hit';

const CLOCK = { getRange: () => ({ start: 100, end: 900 }), getT: () => 500 };

function getMap(times: number[], hasLayer = true) {
  const features = times.map((time, index) => ({
    properties: { id: `q${index}`, time },
  })) as unknown as MapGeoJSONFeature[];
  return {
    getLayer: () => (hasLayer ? ({} as never) : undefined),
    project: () => new Point(0, 0),
    unproject: () => new LngLat(0, 0),
    queryRenderedFeatures: () => features,
  };
}

describe('getVisibleEpicenterId', () => {
  it('returns the topmost earthquake inside the window', () => {
    expect(getVisibleEpicenterId(getMap([300, 400]), [0, 0], CLOCK)).toBe('q0');
  });

  it('skips earthquakes before the window start and after t', () => {
    expect(getVisibleEpicenterId(getMap([50, 600, 300]), [0, 0], CLOCK)).toBe('q2');
    expect(getVisibleEpicenterId(getMap([50, 600]), [0, 0], CLOCK)).toBeNull();
  });

  it('returns null when the layer is missing', () => {
    expect(getVisibleEpicenterId(getMap([300], false), [0, 0], CLOCK)).toBeNull();
  });
});

type PlacedQuake = { id: string; time: number; x: number; y: number; dotRadius: number };

function getPlacedMap(quakes: PlacedQuake[]) {
  const getFeature = ({ id, time, x, y }: PlacedQuake) =>
    ({
      properties: { id, time },
      geometry: { type: 'Point', coordinates: [x, y] },
    }) as unknown as MapGeoJSONFeature;
  return {
    getLayer: () => ({}) as never,
    project: ([x, y]: [number, number]) => ({ x, y }),
    unproject: (point: PointLike) => {
      const { x, y } = Point.convert(point);
      return new LngLat(x, y);
    },
    queryRenderedFeatures: (geometry: unknown) => {
      if (Array.isArray(geometry) && Array.isArray(geometry[0])) {
        const [[minX, minY], [maxX, maxY]] = geometry as [[number, number], [number, number]];
        return quakes
          .filter(({ x, y }) => x >= minX && x <= maxX && y >= minY && y <= maxY)
          .map(getFeature);
      }
      const { x: px, y: py } = Point.convert(geometry as PointLike);
      return quakes
        .filter(({ x, y, dotRadius }) => Math.hypot(x - px, y - py) <= dotRadius)
        .map(getFeature);
    },
  } as never;
}

describe('getVisibleEpicenterId with a tap radius', () => {
  const options = { hitRadiusPx: EPICENTER_TAP_RADIUS_PX };

  it('keeps the dot under the pointer even when another centre is nearer', () => {
    const map = getPlacedMap([
      { id: 'big', time: 300, x: 20, y: 0, dotRadius: 25 },
      { id: 'near', time: 300, x: 3, y: 0, dotRadius: 2 },
    ]);
    expect(getVisibleEpicenterId(map, [0, 0], CLOCK, options)).toBe('big');
  });

  it('returns a small M2.5 dot 10 px away from a miss', () => {
    const map = getPlacedMap([{ id: 'm2.5', time: 300, x: 10, y: 0, dotRadius: 3 }]);
    expect(getVisibleEpicenterId(map, { x: 0, y: 0 } as never, CLOCK, options)).toBe('m2.5');
    expect(getVisibleEpicenterId(map, [0, 0], CLOCK)).toBeNull();
  });

  it('picks the nearest centre when two are in range of a miss', () => {
    const map = getPlacedMap([
      { id: 'far', time: 300, x: 10, y: 0, dotRadius: 3 },
      { id: 'near', time: 300, x: 0, y: -6, dotRadius: 3 },
    ]);
    expect(getVisibleEpicenterId(map, [0, 0], CLOCK, options)).toBe('near');
  });

  it('measures distance against the world copy under the pointer', () => {
    const map = getPlacedMap([
      { id: 'east', time: 300, x: 8, y: 0, dotRadius: 3 },
      { id: 'west', time: 300, x: -5, y: 0, dotRadius: 3 },
    ]);
    const shifted = {
      ...(map as object),
      queryRenderedFeatures: (geometry: unknown) => {
        if (!Array.isArray(geometry) || !Array.isArray(geometry[0])) return [];
        const [[minX, minY], [maxX, maxY]] = geometry as [[number, number], [number, number]];
        return (
          map as { queryRenderedFeatures: (g: unknown) => MapGeoJSONFeature[] }
        ).queryRenderedFeatures([
          [minX - 360, minY],
          [maxX - 360, maxY],
        ]);
      },
    } as never;
    expect(getVisibleEpicenterId(shifted, [357, 0], CLOCK, options)).toBe('west');
  });

  it('never returns earthquakes hidden by the playback clock', () => {
    const exact = getPlacedMap([
      { id: 'hidden', time: 600, x: 0, y: 0, dotRadius: 5 },
      { id: 'shown', time: 300, x: 8, y: 0, dotRadius: 3 },
    ]);
    expect(getVisibleEpicenterId(exact, [0, 0], CLOCK, options)).toBe('shown');
    const box = getPlacedMap([
      { id: 'hidden', time: 50, x: 4, y: 0, dotRadius: 3 },
      { id: 'shown', time: 300, x: 11, y: 0, dotRadius: 3 },
    ]);
    expect(getVisibleEpicenterId(box, [0, 0], CLOCK, options)).toBe('shown');
    const none = getPlacedMap([{ id: 'hidden', time: 600, x: 5, y: 0, dotRadius: 3 }]);
    expect(getVisibleEpicenterId(none, [0, 0], CLOCK, options)).toBeNull();
  });
});

describe('getIsEpicenterVisible', () => {
  it('includes both ends of [start, t]', () => {
    expect(getIsEpicenterVisible(100, CLOCK)).toBe(true);
    expect(getIsEpicenterVisible(500, CLOCK)).toBe(true);
    expect(getIsEpicenterVisible(501, CLOCK)).toBe(false);
  });
});

describe('getWrappedLongitude', () => {
  it('keeps a longitude already in the reference copy', () => {
    expect(getWrappedLongitude(10, 20)).toBe(10);
  });

  it('moves a longitude into the copies either side of the main world', () => {
    expect(getWrappedLongitude(10, 365)).toBe(370);
    expect(getWrappedLongitude(10, -355)).toBe(-350);
  });

  it('crosses the antimeridian to the nearest copy', () => {
    expect(getWrappedLongitude(179, -179)).toBe(-181);
    expect(getWrappedLongitude(-179, 179)).toBe(181);
  });
});
