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
        latitude: 37.1773,
        longitude: -3.5986,
      },
    ]);
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
  it('asks Photon for five results without a language', async () => {
    const fetchMock = stubFetch([
      {
        match: (url) => url.hostname === 'photon.komoot.io',
        respond: () => Response.json(getPhotonCollection()),
      },
    ]);
    await getPlaceSuggestions('granada', new AbortController().signal);
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: 'granada', limit: '5' });
  });

  it('throws when Photon fails', async () => {
    stubFetch([{ match: () => true, respond: () => new Response(null, { status: 429 }) }]);
    await expect(getPlaceSuggestions('granada', new AbortController().signal)).rejects.toThrow(
      '429',
    );
  });
});
