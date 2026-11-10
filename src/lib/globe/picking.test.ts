import { describe, expect, it } from 'vitest';

import type { Earthquake } from '../earthquakes/types';
import type { GlobeView } from './motion';
import { getPickedQuakeIndex, getQuakeScreenPoints, PICK_TOLERANCE_PX } from './picking';
import { getHypocentreRadius } from './quakes';

const FRAME = { cx: 400, cy: 300, radius: 250 };

function getEarthquake(overrides: Partial<Earthquake>): Earthquake {
  return {
    id: 'q',
    source: 'usgs',
    magnitude: 5,
    magnitudeType: 'mw',
    place: null,
    time: 0,
    depthKm: 10,
    longitude: 0,
    latitude: 0,
    url: 'https://example.com',
    ...overrides,
  };
}

function getCentredView(latitude: number, longitude: number, zoom = 1): GlobeView {
  return { lon: (longitude * Math.PI) / 180, lat: (latitude * Math.PI) / 180, zoom };
}

describe('getQuakeScreenPoints', () => {
  it.each([
    [0, 0],
    [35.7, 139.7],
    [-33.4, -70.6],
    [61.2, -149.9],
  ])('puts a quake at %f, %f on the frame centre when the view is centred on it', (lat, lon) => {
    const [epicentre] = getQuakeScreenPoints(
      [getEarthquake({ latitude: lat, longitude: lon })],
      getCentredView(lat, lon, 2.5),
      FRAME,
    );
    expect(Math.abs(epicentre!.x - FRAME.cx)).toBeLessThan(1e-9);
    expect(Math.abs(epicentre!.y - FRAME.cy)).toBeLessThan(1e-9);
  });

  it('projects the epicentre and the hypocentre with y pointing down and zoom scaling', () => {
    const quake = getEarthquake({ latitude: 0, longitude: 90, depthKm: 300 });
    const points = getQuakeScreenPoints([quake], { lon: 0, lat: 0, zoom: 2 }, FRAME);
    const hypocentreRadius = getHypocentreRadius(300);
    expect(points).toHaveLength(2);
    expect(points[0]!.x).toBeCloseTo(FRAME.cx + 500);
    expect(points[0]!.y).toBeCloseTo(FRAME.cy);
    expect(points[1]!.x).toBeCloseTo(FRAME.cx + 500 * hypocentreRadius);
    const north = getQuakeScreenPoints(
      [getEarthquake({ latitude: 30, longitude: 0 })],
      { lon: 0, lat: 0, zoom: 1 },
      FRAME,
    );
    expect(north[0]!.y).toBeCloseTo(FRAME.cy - 125);
  });

  it('skips quakes on the far side', () => {
    const points = getQuakeScreenPoints(
      [getEarthquake({ longitude: 180 }), getEarthquake({ longitude: 10 })],
      { lon: 0, lat: 0, zoom: 1 },
      FRAME,
    );
    expect(points.map((point) => point.index)).toEqual([1, 1]);
  });
});

describe('getPickedQuakeIndex', () => {
  const points = [
    { index: 0, x: 100, y: 100 },
    { index: 1, x: 110, y: 100 },
  ];

  it('picks the nearest point', () => {
    expect(getPickedQuakeIndex(points, 103, 100)).toBe(0);
    expect(getPickedQuakeIndex(points, 108, 100)).toBe(1);
  });

  it('includes points exactly 12 px away and excludes farther ones', () => {
    const single = [{ index: 4, x: 0, y: 0 }];
    expect(PICK_TOLERANCE_PX).toBe(12);
    expect(getPickedQuakeIndex(single, 12, 0)).toBe(4);
    expect(getPickedQuakeIndex(single, 0, -12)).toBe(4);
    expect(getPickedQuakeIndex(single, 12.01, 0)).toBeNull();
    expect(getPickedQuakeIndex([], 0, 0)).toBeNull();
  });

  it('never picks a far-side quake even when its flat projection is under the pointer', () => {
    const view = { lon: 0, lat: 0, zoom: 1 };
    const farSide = getEarthquake({ latitude: 20, longitude: 180 });
    const flatX = FRAME.cx;
    const flatY = FRAME.cy - Math.sin((20 * Math.PI) / 180) * FRAME.radius;
    const points = getQuakeScreenPoints([farSide], view, FRAME);
    expect(getPickedQuakeIndex(points, flatX, flatY)).toBeNull();
  });

  it('picks a quake by its hypocentre', () => {
    const quake = getEarthquake({ latitude: 0, longitude: 60, depthKm: 600 });
    const view = { lon: 0, lat: 0, zoom: 1 };
    const [epicentre, hypocentre] = getQuakeScreenPoints([quake], view, FRAME);
    expect(Math.abs(epicentre!.x - hypocentre!.x)).toBeGreaterThan(PICK_TOLERANCE_PX * 2);
    expect(getPickedQuakeIndex([epicentre!, hypocentre!], hypocentre!.x + 5, hypocentre!.y)).toBe(
      0,
    );
  });
});
