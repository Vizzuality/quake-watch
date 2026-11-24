import { describe, expect, it } from 'vitest';

import { getPhotonCollection } from '@/test/fixtures/places';
import { stubFetch } from '@/test/stub-fetch';

import { getPlaceSuggestions, getPlacesFromPhoton } from './photon';

describe('getPlacesFromPhoton', () => {
  it('maps features to places', () => {
    expect(getPlacesFromPhoton(getPhotonCollection())).toEqual([
      {
        id: 'R344685',
        name: 'Granada',
        label: 'Granada, Andalucía, España',
        group: 'city',
        latitude: 37.1773,
        longitude: -3.5986,
        radiusKm: 100,
      },
    ]);
  });

  it('sizes the search radius from the place extent', () => {
    const json = getPhotonCollection();
    const spain = {
      ...json,
      features: json.features.map((f) => ({
        ...f,
        properties: { ...f.properties, extent: [-18.39, 43.99, 4.59, 27.43] },
      })),
    };
    expect(getPlacesFromPhoton(spain)[0]?.radiusKm).toBe(500);
  });

  it('groups a Photon county as a province', () => {
    const json = getPhotonCollection();
    const typed = {
      ...json,
      features: json.features.map((f) => ({
        ...f,
        properties: { ...f.properties, type: 'county' },
      })),
    };
    expect(getPlacesFromPhoton(typed)[0]?.group).toBe('province');
  });

  it.each(['house', 'street', 'other', undefined])('drops a Photon %s result', (type) => {
    const json = getPhotonCollection();
    const typed = {
      ...json,
      features: json.features.map((f) => ({ ...f, properties: { ...f.properties, type } })),
    };
    expect(getPlacesFromPhoton(typed)).toEqual([]);
  });

  it('names a country once in its label', () => {
    const json = getPhotonCollection(['España']);
    const country = {
      ...json,
      features: json.features.map((f) => ({
        ...f,
        properties: { ...f.properties, state: undefined },
      })),
    };
    expect(getPlacesFromPhoton(country)[0]?.label).toBe('España');
  });

  it('drops features without a name', () => {
    const json = getPhotonCollection();
    const nameless = {
      ...json,
      features: json.features.map((f) => ({
        ...f,
        properties: { ...f.properties, name: undefined },
      })),
    };
    expect(getPlacesFromPhoton(nameless)).toEqual([]);
  });
});

describe('getPlaceSuggestions', () => {
  it('asks Photon for ten area-sized results without a language', async () => {
    const fetchMock = stubFetch([
      {
        match: (url) => url.hostname === 'photon.komoot.io',
        respond: () => Response.json(getPhotonCollection()),
      },
    ]);
    await getPlaceSuggestions('granada', new AbortController().signal);
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.get('q')).toBe('granada');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.has('lang')).toBe(false);
    expect(url.searchParams.getAll('layer')).toEqual([
      'country',
      'state',
      'county',
      'city',
      'district',
      'locality',
    ]);
  });

  it('throws when Photon fails', async () => {
    stubFetch([{ match: () => true, respond: () => new Response(null, { status: 429 }) }]);
    await expect(getPlaceSuggestions('granada', new AbortController().signal)).rejects.toThrow(
      '429',
    );
  });
});
