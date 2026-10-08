import { queryOptions } from '@tanstack/react-query';

import { getLatestEarthquakes } from './feed';

export const earthquakesQueryOptions = queryOptions({
  queryKey: ['earthquakes', 'm2.5-day'],
  queryFn: getLatestEarthquakes,
  refetchInterval: 60_000,
});
