import { rootRouteId } from '@tanstack/react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { overwriteGetLocale } from '@/paraglide/runtime';

import { getPageTitle } from './page-title';

const ROOT = { routeId: rootRouteId, status: 'success' } as const;

describe('getPageTitle', () => {
  afterEach(() => {
    overwriteGetLocale(() => 'en');
  });

  it('titles the home page', () => {
    expect(getPageTitle([ROOT, { routeId: '/', status: 'success' }])).toBe(
      'Earthquakes worldwide | Quake Watch',
    );
  });

  it('titles an unmatched URL as not found', () => {
    expect(getPageTitle([ROOT])).toBe('Page not found | Quake Watch');
  });

  it('titles a failed route as an error', () => {
    expect(getPageTitle([ROOT, { routeId: '/', status: 'error' }])).toBe(
      'Something went wrong | Quake Watch',
    );
  });

  it('falls back to the app title for other routes', () => {
    expect(getPageTitle([ROOT, { routeId: '/robots.txt', status: 'success' }])).toBe('Quake Watch');
  });

  it('titles in Spanish under /es', () => {
    overwriteGetLocale(() => 'es');
    expect(getPageTitle([ROOT, { routeId: '/', status: 'success' }])).toBe(
      'Terremotos en todo el mundo | Quake Watch',
    );
  });
});
