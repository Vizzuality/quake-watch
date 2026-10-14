import { describe, expect, it } from 'vitest';

import { shakemapContours } from '@/test/fixtures/shakemap-contours';

import { getDistanceKm } from '../earthquakes/distance';
import { EarthquakeSourceError } from '../earthquakes/query-options';
import type { ShakemapContour } from './contours';
import { getContourSegments, getContoursReachKm, getShakemapContours } from './contours';
import { S_WAVE_KM_S, getArrivalSeconds } from './wave';

describe('getShakemapContours', () => {
  const contours = getShakemapContours(shakemapContours);

  it('maps value and color of each feature', () => {
    expect(contours.map(({ mmi, color }) => [mmi, color])).toEqual([
      [1.5, '#dfe6ff'],
      [2, '#bfccff'],
      [2.5, '#afd9ff'],
      [4, '#80ffff'],
    ]);
  });

  it('flattens MultiLineString into longitude/latitude lines', () => {
    expect(contours[0].lines).toHaveLength(2);
    expect(contours[0].lines[0][0]).toEqual([-5.8333, 38.5579]);
  });

  it('wraps a LineString as a single line', () => {
    expect(contours[3].lines).toEqual([
      [
        [-4.5, 36.1],
        [-4.2, 36.4],
      ],
    ]);
  });

  it('drops altitude from three-dimensional positions', () => {
    const [contour] = getShakemapContours({
      features: [
        {
          properties: { value: 3, color: '#fff' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [1, 2, 9],
              [3, 4, 9],
            ],
          },
        },
      ],
    });
    expect(contour.lines[0]).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('returns an empty list for a collection without features', () => {
    expect(getShakemapContours({ features: [] })).toEqual([]);
  });

  it.each([
    ['null', null],
    ['no features', {}],
    [
      'an unsupported geometry',
      {
        features: [
          {
            properties: { value: 1, color: '#fff' },
            geometry: { type: 'Point', coordinates: [0, 0] },
          },
        ],
      },
    ],
    [
      'a feature without color',
      {
        features: [
          {
            properties: { value: 1 },
            geometry: {
              type: 'LineString',
              coordinates: [
                [0, 0],
                [1, 1],
              ],
            },
          },
        ],
      },
    ],
  ])('throws EarthquakeSourceError for %s', (_label, json) => {
    expect(() => getShakemapContours(json)).toThrow(EarthquakeSourceError);
  });
});

const line: ShakemapContour = {
  mmi: 3,
  color: '#abcdef',
  lines: [Array.from({ length: 11 }, (_, index) => [index * 0.1, 0] as const)],
};
const origin = { latitude: 0, longitude: 0 };

describe('getContourSegments', () => {
  it('splits lines into joined chunks that keep the contour color', () => {
    const segments = getContourSegments([line], origin, 0);
    expect(segments).toHaveLength(2);
    expect(segments[0].coordinates).toHaveLength(6);
    expect(segments[0].coordinates.at(-1)).toEqual(segments[1].coordinates[0]);
    expect(segments.every(({ color, mmi }) => color === '#abcdef' && mmi === 3)).toBe(true);
  });

  it('times each chunk to the S arrival at its farthest vertex, sorted', () => {
    const [near, far] = getContourSegments(
      [{ ...line, lines: [line.lines[0].toReversed()] }],
      origin,
      10,
    );
    expect(near.arrival).toBeLessThan(far.arrival);
    expect(far.arrival).toBeCloseTo(
      getArrivalSeconds(getDistanceKm(origin, { latitude: 0, longitude: 1 }), 10, S_WAVE_KM_S),
    );
  });
});

describe('getContoursReachKm', () => {
  it('is the distance to the farthest contour vertex', () => {
    expect(getContoursReachKm([line], origin)).toBeCloseTo(
      getDistanceKm(origin, { latitude: 0, longitude: 1 }),
    );
    expect(getContoursReachKm([], origin)).toBe(0);
  });
});
