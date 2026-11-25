import { describe, expect, it } from 'vitest';

import type { SearchRadiusKm } from '../earthquakes/search-schema';
import { getAreaGlobeView, getAreaMapZoom, isAreaFramedOnMap } from './area-view';
import { INITIAL_VIEW, ZOOM_RANGE } from './motion';
import { EARTH_RADIUS_KM } from './quakes';

function getArea(radiusKm: SearchRadiusKm) {
  return { latitude: 37.17, longitude: -3.6, radiusKm };
}

describe('isAreaFramedOnMap', () => {
  it.each([50, 100, 250] as const)('hands a %i km area over to the close-up map', (radiusKm) => {
    expect(isAreaFramedOnMap(getArea(radiusKm))).toBe(true);
  });

  it('keeps a 500 km area on the globe', () => {
    expect(isAreaFramedOnMap(getArea(500))).toBe(false);
  });
});

describe('getAreaGlobeView', () => {
  it('flies to the globe’s closest zoom over an area the map will frame', () => {
    const view = getAreaGlobeView(getArea(50), INITIAL_VIEW);

    expect(view.zoom).toBe(ZOOM_RANGE[1]);
    expect((view.lat * 180) / Math.PI).toBeCloseTo(37.17, 6);
  });

  it('flies to zoom 3 over a 500 km area, centred on it', () => {
    const view = getAreaGlobeView(getArea(500), INITIAL_VIEW);

    expect(view.zoom).toBe(3);
    expect((view.lat * 180) / Math.PI).toBeCloseTo(37.17, 6);
    expect(((view.lon * 180) / Math.PI + 360) % 360).toBeCloseTo(356.4, 6);
  });
});

describe('getAreaMapZoom', () => {
  it('zooms the map until the radius spans the given pixels at the centre of the area', () => {
    const area = getArea(50);
    const zoom = getAreaMapZoom(area, 282);
    const worldPx = 512 * 2 ** zoom;
    const kmPerPx = (2 * Math.PI * EARTH_RADIUS_KM * Math.cos((37.17 * Math.PI) / 180)) / worldPx;

    expect(50 / kmPerPx).toBeCloseTo(282, 6);
  });

  it('zooms out one step each time the radius doubles', () => {
    expect(getAreaMapZoom(getArea(100), 282) - getAreaMapZoom(getArea(50), 282)).toBeCloseTo(-1, 6);
  });
});
