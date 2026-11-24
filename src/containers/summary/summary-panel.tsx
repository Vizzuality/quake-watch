import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { InfoLabel } from '@/components/info-button/info-button';
import { requestGlobeSelect } from '@/containers/globe/globe-select';
import { getQuakeKey } from '@/containers/globe/use-hovered-quake';
import { useFilterSearch } from '@/hooks/use-filter-search';
import { useIsQuakeSelected } from '@/hooks/use-is-quake-selected';
import { getMagnitudeValueLabel } from '@/lib/earthquakes/details-panel';
import { playbackClock } from '@/lib/earthquakes/playback-clock';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { getRegionEarthquakes } from '@/lib/earthquakes/regions';
import { getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import {
  type SummaryStats,
  getSummaryIndex,
  getSummaryShownCount,
  getSummaryStats,
} from '@/lib/earthquakes/summary';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getDecimalLabel } from '@/lib/format';
import { SUMMARY_ID } from '@/lib/layout/skip-targets';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { type Locale, getLocale } from '@/paraglide/runtime';

import { getCountPhrase } from './count-phrase';

const homeRoute = getRouteApi('/');
const EMPTY_EARTHQUAKES: Earthquake[] = [];
const NO_VALUE = '—';
const FOCUS_RETURN_FRAMES = 3;

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

type StatSelect = { label: string; onSelect: () => void };

function isFocusLost(): boolean {
  return document.activeElement === null || document.activeElement === document.body;
}

function getOptionalQuakeKey(earthquake: Earthquake | null): string | undefined {
  return earthquake ? getQuakeKey(earthquake) : undefined;
}

function getLargestSelect(
  largest: Earthquake | null,
  locale: Locale,
  onSelect: (earthquake: Earthquake) => void,
): StatSelect | undefined {
  if (!largest) return undefined;
  return { label: m.summary_open_largest({}, { locale }), onSelect: () => onSelect(largest) };
}

function getSummaryClassName(isHidden: boolean): string {
  return cn(
    'outline-none md:absolute md:top-[143px] md:left-14 md:z-10 md:w-[250px] md:[transition:opacity_450ms_ease-out,translate_600ms_ease-out,visibility_600ms] md:motion-reduce:transition-none',
    isHidden && 'md:pointer-events-none md:invisible md:-translate-x-6 md:opacity-0',
  );
}

function getAreaEarthquakes(earthquakes: Earthquake[], place: string | undefined): Earthquake[] {
  return place === undefined ? earthquakes : getRegionEarthquakes(earthquakes, place);
}

function getCountClassName(place: string | undefined): string {
  const padding = place === undefined ? 'md:py-6' : 'pt-1 md:pt-2 md:pb-6';
  return `flex items-baseline gap-3 text-foreground md:flex-col md:items-stretch md:gap-2 ${padding}`;
}

function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      className="shrink-0 text-muted md:hidden"
    >
      <path
        d="M6 3.5L10.5 8L6 12.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type SummaryStatProps = {
  label: string;
  info: string;
  value: string;
  select?: StatSelect;
  selectRef?: RefObject<HTMLButtonElement | null>;
};

function SummaryStat({ label, info, value, select, selectRef }: SummaryStatProps) {
  return (
    <div className="relative flex min-w-0 flex-col items-start gap-1.5 border-t border-line pt-2.5 md:gap-1 md:py-4">
      <dt className="pointer-events-none relative z-10 flex min-h-4 max-w-full items-center md:pointer-events-auto md:h-4">
        <InfoLabel
          label={label}
          info={info}
          className="text-label text-muted uppercase max-md:line-clamp-2 max-md:whitespace-normal"
        />
      </dt>
      <dd className="flex w-full items-center justify-between text-value-m whitespace-nowrap text-foreground md:block md:w-auto md:text-numeral-l">
        {value}
        {select && (
          <>
            <ChevronIcon />
            <button
              ref={selectRef}
              type="button"
              aria-label={select.label}
              onClick={select.onSelect}
              className="absolute inset-0 cursor-pointer"
            />
          </>
        )}
      </dd>
    </div>
  );
}

export function SummaryPanel() {
  const search = homeRoute.useSearch();
  const { data } = useQuery(earthquakesQueryOptions(getEarthquakeFilters(search)));
  const isQuakeSelected = useIsQuakeSelected();
  const setSearch = useFilterSearch();
  const locale = getLocale();
  const { place, quake } = search;
  const earthquakes = data?.earthquakes ?? EMPTY_EARTHQUAKES;
  const index = useMemo(
    () => getSummaryIndex(getAreaEarthquakes(earthquakes, place)),
    [earthquakes, place],
  );
  const [shownCount, setShownCount] = useState<number | null>(null);
  const stats: SummaryStats = getSummaryStats(index, shownCount ?? index.sortedTimes.length);
  const isAreaEmpty = place !== undefined && stats.count === 0;
  const largestKey = getOptionalQuakeKey(stats.largest);
  const largestRef = useRef<HTMLButtonElement>(null);
  const previousQuakeRef = useRef(quake);

  function selectQuake(earthquake: Earthquake) {
    if (requestGlobeSelect(earthquake)) return;
    void setSearch({ quake: getQuakeKey(earthquake) });
  }

  useEffect(() => {
    const previousQuake = previousQuakeRef.current;
    previousQuakeRef.current = quake;
    if (quake !== undefined || previousQuake === undefined || previousQuake !== largestKey) return;
    let frame = 0;
    // The desktop summary fades in with a `visibility` transition, which keeps it unfocusable for its first frame.
    function returnFocus(framesLeft: number) {
      if (!isFocusLost()) return;
      largestRef.current?.focus();
      if (framesLeft > 0) frame = requestAnimationFrame(() => returnFocus(framesLeft - 1));
    }
    returnFocus(FOCUS_RETURN_FRAMES);
    return () => cancelAnimationFrame(frame);
  }, [quake, largestKey]);

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
      id={SUMMARY_ID}
      tabIndex={-1}
      aria-label={m.summary_label({}, { locale })}
      aria-hidden={isQuakeSelected}
      inert={isQuakeSelected}
      data-testid="summary"
      data-ring-obstacle
      data-label-obstacle
      className={getSummaryClassName(isQuakeSelected)}
    >
      {place !== undefined && (
        <p
          data-testid="summary-eyebrow"
          className="truncate text-label text-muted uppercase md:pt-6"
        >
          {m.summary_in_view({ place }, { locale })}
        </p>
      )}
      {isAreaEmpty ? (
        <h2 className="border-b border-line pt-2 pb-6 text-body text-foreground">
          {m.summary_area_empty({}, { locale })}
        </h2>
      ) : (
        <>
          <h2 className={getCountClassName(place)}>
            <span data-testid="summary-count" className="text-stat md:text-numeral-l">
              {getDecimalLabel(stats.count, locale)}
            </span>{' '}
            <span className="text-lead md:text-value">
              {getCountPhrase(search, stats.count, locale)}
            </span>
          </h2>
          <dl className="mt-3.5 grid grid-cols-2 gap-3.5 md:mt-0 md:block md:border-b md:border-line">
            <SummaryStat
              label={m.summary_likely_felt({}, { locale })}
              info={m.info_summary_likely_felt({}, { locale })}
              value={getDecimalLabel(stats.feltCount, locale)}
            />
            <SummaryStat
              label={getLargestLabel(stats.largest, place, locale)}
              info={m.info_summary_largest({}, { locale })}
              value={getLargestValue(stats.largest, locale)}
              select={getLargestSelect(stats.largest, locale, selectQuake)}
              selectRef={largestRef}
            />
          </dl>
        </>
      )}
    </section>
  );
}
