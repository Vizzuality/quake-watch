import { describe, expect, it } from 'vitest';

import { shakemapContours } from '@/test/fixtures/shakemap-contours';

import { EarthquakeSourceError } from '../earthquakes/query-options';
import { getShakemapContours } from './contours';

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
