import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';

import { type FilterSearchPatch, useFilterSearch } from '@/hooks/use-filter-search';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import {
  type Depth,
  type EarthquakeSearch,
  type Interval,
  type MinMagnitude,
  type SourceFilter,
  getDefaultCustomRange,
  getEarthquakeFilters,
  getTimeWindow,
} from '@/lib/earthquakes/search-schema';
import { LONG_WINDOW_LIMIT, isLongWindow } from '@/lib/earthquakes/sources/feature-collection';
import { getDecimalLabel } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

import { CustomRange } from './custom-range';
import { FilterGroup, type FilterGroupOption } from './filter-group';

function getIntervalOptions(): FilterGroupOption<Interval>[] {
  return [
    { value: '24h', label: m.filter_interval_24h() },
    { value: '3d', label: m.filter_interval_3d() },
    { value: '7d', label: m.filter_interval_7d() },
    { value: '1y', label: m.filter_interval_1y() },
    { value: 'custom', label: m.filter_interval_custom() },
  ];
}

function getMagnitudeOptions(): FilterGroupOption<MinMagnitude>[] {
  return [
    { value: 0, label: m.filter_all() },
    { value: 3, label: m.filter_magnitude_min({ magnitude: 3 }) },
    { value: 4, label: m.filter_magnitude_min({ magnitude: 4 }) },
    { value: 5, label: m.filter_magnitude_min({ magnitude: 5 }) },
    { value: 6, label: m.filter_magnitude_min({ magnitude: 6 }) },
  ];
}

function getDepthOptions(): FilterGroupOption<Depth>[] {
  return [
    { value: 'all', label: m.filter_all() },
    { value: 'shallow', label: m.filter_depth_shallow() },
    { value: 'mid', label: m.filter_depth_mid() },
    { value: 'deep', label: m.filter_depth_deep() },
  ];
}

function getSourceOptions(): FilterGroupOption<SourceFilter>[] {
  return [
    { value: 'all', label: m.filter_source_all() },
    { value: 'usgs', label: m.filter_source_usgs() },
    { value: 'emsc', label: m.filter_source_emsc() },
  ];
}

function getIntervalPatch(
  interval: Interval,
  search: Pick<EarthquakeSearch, 'from' | 'to'>,
): FilterSearchPatch {
  if (interval !== 'custom') return { interval, from: undefined, to: undefined };
  if (search.from && search.to) return { interval, from: search.from, to: search.to };
  return { interval, ...getDefaultCustomRange(Date.now()) };
}

export function FiltersPanel() {
  const search = useSearch({ from: '/' });
  const { data } = useQuery(earthquakesQueryOptions(getEarthquakeFilters(search)));
  const setSearch = useFilterSearch();
  const { interval, minmag, depth, source, quake, from, to } = search;
  const isTruncated =
    data?.isTruncated === true && isLongWindow(getTimeWindow(search, data.fetchedAt));

  if (quake) return null;

  return (
    <section
      aria-label={m.filters_label()}
      data-ring-obstacle
      className="pointer-events-auto mt-[18px] md:absolute md:top-[159px] md:right-14 md:z-10 md:mt-0 md:w-[230px] md:border-b md:border-line"
    >
      <h2 className="sr-only">{m.filters_label()}</h2>
      <FilterGroup
        label={m.filter_time()}
        info={m.info_filter_time()}
        options={getIntervalOptions()}
        value={interval}
        onChange={(next) => setSearch(getIntervalPatch(next, { from, to }))}
      >
        {interval === 'custom' && <CustomRange from={from} to={to} />}
        {isTruncated && (
          <p data-testid="filter-truncated" className="mt-1 text-body-s text-muted md:mt-0">
            {m.filter_truncated({ count: getDecimalLabel(LONG_WINDOW_LIMIT, getLocale()) })}
          </p>
        )}
      </FilterGroup>
      <FilterGroup
        label={m.filter_magnitude()}
        info={m.info_filter_magnitude()}
        options={getMagnitudeOptions()}
        value={minmag}
        onChange={(next) => setSearch({ minmag: next })}
      />
      <FilterGroup
        label={m.filter_depth()}
        info={m.info_filter_depth()}
        options={getDepthOptions()}
        value={depth}
        onChange={(next) => setSearch({ depth: next })}
      />
      <FilterGroup
        label={m.filter_source()}
        info={m.info_filter_source()}
        options={getSourceOptions()}
        value={source}
        onChange={(next) => setSearch({ source: next })}
      />
    </section>
  );
}
