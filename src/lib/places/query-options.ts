import { queryOptions } from '@tanstack/react-query';

import { getPlaceSuggestions } from './photon';

export const PLACE_QUERY_MIN_LENGTH = 3;
export const PLACE_QUERY_DEBOUNCE_MS = 300;

export function placeSuggestionsQueryOptions(text: string) {
  const query = text.trim();
  return queryOptions({
    queryKey: ['places', query.toLowerCase()] as const,
    queryFn: ({ signal }) => getPlaceSuggestions(query, signal),
    enabled: query.length >= PLACE_QUERY_MIN_LENGTH,
    staleTime: Infinity,
    retry: false,
  });
}
