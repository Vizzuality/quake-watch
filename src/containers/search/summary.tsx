import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { SOURCE_ADAPTERS, earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { getSearchCenter } from '@/lib/earthquakes/search-schema';
import type { EarthquakeSearch } from '@/lib/earthquakes/search-schema';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getKmLabel } from '@/lib/format';
import { getEarthquakeCountLabel } from '@/lib/i18n/earthquake-count';
import { getPeriodLabel, getPlaceLabel } from '@/lib/i18n/labels';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';
import { getLocale } from '@/paraglide/runtime';

function getSummaryLabel(
  search: EarthquakeSearch,
  earthquakes: Earthquake[],
  locale: Locale,
): string {
  const inputs = {
    count: getEarthquakeCountLabel(earthquakes.length, locale),
    period: getPeriodLabel(search, locale),
    source: SOURCE_ADAPTERS[search.source].label,
  };
  if (!getSearchCenter(search)) return m.summary_world(inputs);
  return m.summary_near({
    ...inputs,
    radius: getKmLabel(search.radius, locale),
    place: getPlaceLabel(search, locale),
  });
}

export function SearchSummary() {
  const search = useEarthquakeSearch();
  const { data, isPlaceholderData } = useQuery({
    ...earthquakesQueryOptions(search),
    placeholderData: keepPreviousData,
  });
  if (!data) return null;

  const summary = isPlaceholderData
    ? m.loading_earthquakes()
    : getSummaryLabel(search, data.earthquakes, getLocale());

  return (
    <p aria-live="polite" aria-busy={isPlaceholderData} className="text-sm text-muted">
      {summary}
    </p>
  );
}
