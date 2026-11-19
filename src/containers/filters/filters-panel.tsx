import { useSearch } from '@tanstack/react-router';

import { useFilterSearch } from '@/hooks/use-filter-search';
import type {
  Depth,
  EarthquakeSource,
  Interval,
  MinMagnitude,
} from '@/lib/earthquakes/search-schema';
import { m } from '@/paraglide/messages';

import { FilterGroup, type FilterGroupOption } from './filter-group';

function getIntervalOptions(): FilterGroupOption<Interval>[] {
  return [
    { value: '24h', label: m.filter_interval_24h() },
    { value: '3d', label: m.filter_interval_3d() },
    { value: '7d', label: m.filter_interval_7d() },
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

function getSourceOptions(): FilterGroupOption<EarthquakeSource>[] {
  return [
    { value: 'usgs', label: m.filter_source_usgs() },
    { value: 'emsc', label: m.filter_source_emsc() },
  ];
}

export function FiltersPanel() {
  const { interval, minmag, depth, source, quake } = useSearch({ from: '/' });
  const setSearch = useFilterSearch();

  if (quake) return null;

  return (
    <section
      aria-label={m.filters_label()}
      className="pointer-events-auto absolute top-[159px] right-14 z-10 w-[230px] border-b border-line"
    >
      <FilterGroup
        label={m.filter_time()}
        info={m.info_filter_time()}
        options={getIntervalOptions()}
        value={interval}
        onChange={(next) => setSearch({ interval: next })}
      />
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
