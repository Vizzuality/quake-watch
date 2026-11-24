import { z } from 'zod';

import { getExtentRadius } from '@/lib/earthquakes/search-area';
import type { SearchRadiusKm } from '@/lib/earthquakes/search-schema';

import { PHOTON_TYPES, type PlaceGroup, getPlaceGroup } from './place-groups';

const PHOTON_URL = 'https://photon.komoot.io/api/';
const PLACE_SUGGESTION_LIMIT = 10;

export type Place = {
  id: string;
  name: string;
  label: string;
  group: PlaceGroup;
  latitude: number;
  longitude: number;
  radiusKm: SearchRadiusKm;
};

const photonFeatureSchema = z.object({
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
  properties: z.object({
    osm_type: z.string(),
    osm_id: z.number(),
    name: z.string(),
    type: z.enum(PHOTON_TYPES),
    state: z.string().optional(),
    country: z.string().optional(),
    extent: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional().catch(undefined),
  }),
});

const photonCollectionSchema = z.object({ features: z.array(z.unknown()) });

function getPlace(feature: unknown): Place | null {
  const result = photonFeatureSchema.safeParse(feature);
  if (!result.success) return null;
  const { geometry, properties } = result.data;
  const [longitude, latitude] = geometry.coordinates;
  return {
    id: `${properties.osm_type}${properties.osm_id}`,
    name: properties.name,
    label: [...new Set([properties.name, properties.state, properties.country])]
      .filter(Boolean)
      .join(', '),
    group: getPlaceGroup(properties.type),
    latitude,
    longitude,
    radiusKm: getExtentRadius(properties.extent),
  };
}

export function getPlacesFromPhoton(json: unknown): Place[] {
  return photonCollectionSchema.parse(json).features.flatMap((feature) => getPlace(feature) ?? []);
}

export async function getPlaceSuggestions(text: string, signal: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams([
    ['q', text],
    ['limit', String(PLACE_SUGGESTION_LIMIT)],
    ...PHOTON_TYPES.map((type) => ['layer', type]),
  ]);
  const response = await fetch(`${PHOTON_URL}?${params}`, { signal });
  if (!response.ok) throw new Error(`Photon request failed with status ${response.status}`);
  return getPlacesFromPhoton(await response.json());
}
