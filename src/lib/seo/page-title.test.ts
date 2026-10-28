import { rootRouteId } from '@tanstack/react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { overwriteGetLocale } from '@/paraglide/runtime';

import { getPageTitle } from './page-title';

const ROOT = { routeId: rootRouteId, status: 'success', search: {} } as const;

describe('getPageTitle', () => {
  afterEach(() => {
    overwriteGetLocale(() => 'en');
  });

  it('titles the table with the worldwide search', () => {
    expect(getPageTitle([ROOT, { routeId: '/', status: 'success', search: {} }])).toBe(
      'Earthquakes worldwide | Quake Watch',
    );
  });

  it('names the Place of interest on the table', () => {
    expect(
      getPageTitle([ROOT, { routeId: '/', status: 'success', search: { place: 'Granada' } }]),
    ).toBe('Earthquakes near Granada | Quake Watch');
  });

  it('titles the map', () => {
    expect(getPageTitle([ROOT, { routeId: '/map', status: 'success', search: {} }])).toBe(
      'Earthquake map | Quake Watch',
    );
  });

  it('titles an unmatched URL as not found', () => {
    expect(getPageTitle([ROOT])).toBe('Page not found | Quake Watch');
  });

  it('titles an unknown earthquake as not found', () => {
    expect(
      getPageTitle([
        ROOT,
        { routeId: '/earthquakes/usgs/$earthquakeId', status: 'notFound', search: {} },
      ]),
    ).toBe('Earthquake not found | Quake Watch');
  });

  it('titles a failed route as an error', () => {
    expect(getPageTitle([ROOT, { routeId: '/map', status: 'error', search: {} }])).toBe(
      'Something went wrong | Quake Watch',
    );
  });

  it('titles in Spanish under /es', () => {
    overwriteGetLocale(() => 'es');
    expect(getPageTitle([ROOT, { routeId: '/map', status: 'success', search: {} }])).toBe(
      'Mapa de terremotos | Quake Watch',
    );
  });
});
