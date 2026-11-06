import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

import type { EarthquakeSearch } from '@/lib/earthquakes/search-schema';

export type FilterSearchPatch = Partial<
  Pick<EarthquakeSearch, 'source' | 'place' | 'interval' | 'minmag' | 'depth' | 'quake'>
>;

export function useFilterSearch() {
  const navigate = useNavigate({ from: '/' });

  return useCallback(
    (patch: FilterSearchPatch) => navigate({ search: (prev) => ({ ...prev, ...patch }) }),
    [navigate],
  );
}
