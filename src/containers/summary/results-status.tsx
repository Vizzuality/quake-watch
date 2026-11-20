import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';

import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { getRegionEarthquakes } from '@/lib/earthquakes/regions';
import { type Interval, getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getDecimalLabel } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { type Locale, getLocale } from '@/paraglide/runtime';

import { getCountPhrase } from './count-phrase';

type ResultsAnnouncementInput = {
  earthquakes: readonly Earthquake[] | undefined;
  interval: Interval;
  place: string | undefined;
  locale: Locale;
};

function getCountSentence(count: number, interval: Interval, locale: Locale): string {
  return `${getDecimalLabel(count, locale)} ${getCountPhrase(interval, count, locale)}`;
}

export function getResultsAnnouncement({
  earthquakes,
  interval,
  place,
  locale,
}: ResultsAnnouncementInput): string {
  if (earthquakes === undefined) return '';
  if (place === undefined) return getCountSentence(earthquakes.length, interval, locale);
  const count = getRegionEarthquakes(earthquakes, place).length;
  if (count === 0) return m.summary_area_empty({}, { locale });
  return `${m.summary_in_view({ place }, { locale })}. ${getCountSentence(count, interval, locale)}`;
}

const homeRoute = getRouteApi('/');

export function ResultsStatus() {
  const search = homeRoute.useSearch();
  const { data } = useQuery(earthquakesQueryOptions(getEarthquakeFilters(search)));

  return (
    <output data-testid="results-status" className="sr-only">
      {getResultsAnnouncement({
        earthquakes: data?.earthquakes,
        interval: search.interval,
        place: search.place,
        locale: getLocale(),
      })}
    </output>
  );
}
