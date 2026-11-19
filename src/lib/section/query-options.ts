import { queryOptions } from '@tanstack/react-query';

import { getBinaryAsset } from './binary-asset';
import { CRUST_LAYERS_URL, getDecodedCrustLayers } from './crust-layers';
import { getReliefElevations } from './relief';
import { SLAB_DEPTHS_URL, getDecodedSlabGrids } from './slab-depth';

export function crustLayersQueryOptions() {
  return queryOptions({
    queryKey: ['section', 'crust-layers'] as const,
    queryFn: async ({ signal }) =>
      getDecodedCrustLayers(await getBinaryAsset(await fetch(CRUST_LAYERS_URL, { signal }))),
    staleTime: Infinity,
  });
}

export function slabGridsQueryOptions() {
  return queryOptions({
    queryKey: ['section', 'slab-grids'] as const,
    queryFn: async ({ signal }) =>
      getDecodedSlabGrids(await getBinaryAsset(await fetch(SLAB_DEPTHS_URL, { signal }))),
    staleTime: Infinity,
  });
}

export function reliefQueryOptions(latitude: number, longitude: number) {
  return queryOptions({
    queryKey: ['section', 'relief', latitude, longitude] as const,
    queryFn: ({ signal }) => getReliefElevations(latitude, longitude, signal),
    staleTime: Infinity,
  });
}
