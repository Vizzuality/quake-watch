import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';

import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { type SearchArea, getAreaEarthquakes, getSearchArea } from '@/lib/earthquakes/search-area';
import { type TimeFilters, getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getDecimalLabel } from '@/lib/format';
import { getPlaceLabel } from '@/lib/i18n/labels';
import { m } from '@/paraglide/messages';
import { type Locale, getLocale } from '@/paraglide/runtime';

import { getCountPhrase } from './count-phrase';

type ResultsAnnouncementInput = {
  earthquakes: readonly Earthquake[] | undefined;
  filters: TimeFilters;
  area: SearchArea | null;
  place: string;
  locale: Locale;
};

function getCountSentence(count: number, filters: TimeFilters, locale: Locale): string {
  return `${getDecimalLabel(count, locale)} ${getCountPhrase(filters, count, locale)}`;
}

export function getResultsAnnouncement({
  earthquakes,
  filters,
  area,
  place,
  locale,
}: ResultsAnnouncementInput): string {
  if (earthquakes === undefined) return '';
  if (area === null) return getCountSentence(earthquakes.length, filters, locale);
  const count = getAreaEarthquakes(earthquakes, area).length;
  if (count === 0) return m.summary_area_empty({}, { locale });
  return `${m.summary_in_view({ place }, { locale })}. ${getCountSentence(count, filters, locale)}`;
}

const homeRoute = getRouteApi('/');

export function ResultsStatus() {
  const search = homeRoute.useSearch();
  const { data } = useQuery(earthquakesQueryOptions(getEarthquakeFilters(search)));
  const locale = getLocale();

  return (
    <output data-testid="results-status" className="sr-only">
      {getResultsAnnouncement({
        earthquakes: data?.earthquakes,
        filters: search,
        area: getSearchArea(search),
        place: getPlaceLabel(search, locale),
        locale,
      })}
    </output>
  );
}
