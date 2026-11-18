import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useLayoutEffect, useMemo, useState } from 'react';

import { InfoLabel } from '@/components/info-button/info-button';
import { useIsQuakeSelected } from '@/hooks/use-is-quake-selected';
import { getMagnitudeValueLabel } from '@/lib/earthquakes/details-panel';
import { playbackClock } from '@/lib/earthquakes/playback-clock';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { getRegionEarthquakes } from '@/lib/earthquakes/regions';
import { type Interval, getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import {
  type SummaryStats,
  getSummaryIndex,
  getSummaryShownCount,
  getSummaryStats,
} from '@/lib/earthquakes/summary';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getDecimalLabel } from '@/lib/format';
import { getIntlLocale } from '@/lib/i18n/intl-locale';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { type Locale, getLocale } from '@/paraglide/runtime';

const homeRoute = getRouteApi('/');
const EMPTY_EARTHQUAKES: Earthquake[] = [];
const NO_VALUE = '—';

type CountPhrase = (inputs: Record<string, never>, options: { locale: Locale }) => string;

const COUNT_PHRASES: Record<Interval, { one: CountPhrase; other: CountPhrase }> = {
  '24h': { one: m.summary_earthquakes_24h_one, other: m.summary_earthquakes_24h_other },
  '3d': { one: m.summary_earthquakes_3d_one, other: m.summary_earthquakes_3d_other },
  '7d': { one: m.summary_earthquakes_7d_one, other: m.summary_earthquakes_7d_other },
};

function getCountPhrase(interval: Interval, count: number, locale: Locale): string {
  const phrases = COUNT_PHRASES[interval];
  const phrase =
    new Intl.PluralRules(getIntlLocale(locale)).select(count) === 'one'
      ? phrases.one
      : phrases.other;
  return phrase({}, { locale });
}

function getLargestLabel(
  largest: Earthquake | null,
  place: string | undefined,
  locale: Locale,
): string {
  if (place !== undefined) return m.summary_largest_here({}, { locale });
  if (!largest?.place) return m.summary_largest({}, { locale });
  return m.summary_largest_at({ place: largest.place }, { locale });
}

function getLargestValue(largest: Earthquake | null, locale: Locale): string {
  return largest ? getMagnitudeValueLabel(largest.magnitude, locale) : NO_VALUE;
}

function getSummaryClassName(isHidden: boolean): string {
  return cn(
    'absolute top-[143px] left-14 z-10 w-[250px] [transition:opacity_450ms_ease-out,translate_600ms_ease-out,visibility_600ms] motion-reduce:transition-none',
    isHidden && 'pointer-events-none invisible -translate-x-6 opacity-0',
  );
}

function getAreaEarthquakes(earthquakes: Earthquake[], place: string | undefined): Earthquake[] {
  return place === undefined ? earthquakes : getRegionEarthquakes(earthquakes, place);
}

function getCountClassName(place: string | undefined): string {
  const padding = place === undefined ? 'py-6' : 'pt-2 pb-6';
  return `flex flex-col gap-2 text-foreground ${padding}`;
}

type SummaryStatProps = { label: string; info: string; value: string };

function SummaryStat({ label, info, value }: SummaryStatProps) {
  return (
    <div className="flex flex-col items-start gap-1 border-t border-line py-4">
      <dt className="flex h-4 max-w-full items-center">
        <InfoLabel label={label} info={info} className="text-label text-muted uppercase" />
      </dt>
      <dd className="text-numeral-l whitespace-nowrap text-foreground">{value}</dd>
    </div>
  );
}

export function SummaryPanel() {
  const search = homeRoute.useSearch();
  const { data } = useQuery(earthquakesQueryOptions(getEarthquakeFilters(search)));
  const isQuakeSelected = useIsQuakeSelected();
  const locale = getLocale();
  const { place } = search;
  const earthquakes = data?.earthquakes ?? EMPTY_EARTHQUAKES;
  const index = useMemo(
    () => getSummaryIndex(getAreaEarthquakes(earthquakes, place)),
    [earthquakes, place],
  );
  const [shownCount, setShownCount] = useState<number | null>(null);
  const stats: SummaryStats = getSummaryStats(index, shownCount ?? index.sortedTimes.length);
  const isAreaEmpty = place !== undefined && stats.count === 0;

  useLayoutEffect(() => {
    let current: number | null = null;
    function update() {
      const next = getSummaryShownCount(index, playbackClock.getPlayhead());
      if (next === current) return;
      current = next;
      setShownCount(next);
    }
    update();
    return playbackClock.subscribeFrame(update);
  }, [index]);

  if (!data) return null;
  return (
    <section
      aria-label={m.summary_label({}, { locale })}
      aria-hidden={isQuakeSelected}
      inert={isQuakeSelected}
      data-testid="summary"
      className={getSummaryClassName(isQuakeSelected)}
    >
      {place !== undefined && (
        <p data-testid="summary-eyebrow" className="truncate pt-6 text-label text-muted uppercase">
          {m.summary_in_view({ place }, { locale })}
        </p>
      )}
      {isAreaEmpty ? (
        <p className="border-b border-line pt-2 pb-6 text-body text-foreground">
          {m.summary_area_empty({}, { locale })}
        </p>
      ) : (
        <>
          <p className={getCountClassName(place)}>
            <span data-testid="summary-count" className="text-numeral-l">
              {getDecimalLabel(stats.count, locale)}
            </span>{' '}
            <span className="text-value">
              {getCountPhrase(search.interval, stats.count, locale)}
            </span>
          </p>
          <dl className="border-b border-line">
            <SummaryStat
              label={m.summary_likely_felt({}, { locale })}
              info={m.info_summary_likely_felt({}, { locale })}
              value={getDecimalLabel(stats.feltCount, locale)}
            />
            <SummaryStat
              label={getLargestLabel(stats.largest, place, locale)}
              info={m.info_summary_largest({}, { locale })}
              value={getLargestValue(stats.largest, locale)}
            />
          </dl>
        </>
      )}
    </section>
  );
}
