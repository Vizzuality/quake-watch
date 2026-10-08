import { useNavigate, useSearch } from '@tanstack/react-router';

import { earthquakeSearchSchema } from '@/lib/earthquakes/search-schema';
import type { EarthquakeSearch } from '@/lib/earthquakes/search-schema';

export function useEarthquakeSearch(): EarthquakeSearch {
  return earthquakeSearchSchema.parse(useSearch({ strict: false }));
}

export function useSetEarthquakeSearch() {
  const navigate = useNavigate();
  return (patch: Partial<EarthquakeSearch>) =>
    void navigate({
      to: '.',
      search: (previous: Partial<EarthquakeSearch>) => ({ ...previous, page: 1, ...patch }),
      replace: true,
    });
}
