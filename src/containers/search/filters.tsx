import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Select } from '@/components/ui/select';
import { PlaceSearch } from '@/containers/search/place-search';
import { useEarthquakeSearch, useSetEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { SOURCE_ADAPTERS } from '@/lib/earthquakes/query-options';
import {
  EARTHQUAKE_FILTER_DEFAULTS,
  MIN_MAGNITUDES,
  PERIODS,
  RADII_KM,
  SOURCES,
  earthquakeSearchSchema,
  getSearchCenter,
} from '@/lib/earthquakes/search-schema';
import type { EarthquakeSearch } from '@/lib/earthquakes/search-schema';
import { getKmLabel } from '@/lib/format';
import { getPeriodOptionLabel } from '@/lib/i18n/labels';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

const SOURCE_OPTIONS = SOURCES.map((source) => ({
  value: source,
  label: SOURCE_ADAPTERS[source].label,
}));

const CLEARED_FILTERS: Partial<EarthquakeSearch> = {
  ...EARTHQUAKE_FILTER_DEFAULTS,
  place: undefined,
  lat: undefined,
  lon: undefined,
  from: undefined,
  to: undefined,
};

function getPlaceKey(search: EarthquakeSearch): string {
  return `${search.lat},${search.lon}`;
}

function getMinMagnitudeLabel(magnitude: number): string {
  return magnitude === 0 ? m.min_magnitude_all() : `M${magnitude}+`;
}

export function Filters({ idPrefix }: { idPrefix: string }) {
  const search = useEarthquakeSearch();
  const setSearch = useSetEarthquakeSearch();
  const locale = getLocale();
  const { shape } = earthquakeSearchSchema;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <PlaceSearch key={getPlaceKey(search)} id={`${idPrefix}-place`} />
      <Field id={`${idPrefix}-radius`} label={m.filter_radius()}>
        <Select
          id={`${idPrefix}-radius`}
          disabled={getSearchCenter(search) === null}
          value={search.radius}
          onChange={(event) =>
            setSearch({ radius: shape.radius.parse(Number(event.target.value)) })
          }
        >
          {RADII_KM.map((radius) => (
            <option key={radius} value={radius}>
              {getKmLabel(radius, locale)}
            </option>
          ))}
        </Select>
      </Field>
      <Field id={`${idPrefix}-period`} label={m.filter_period()}>
        <Select
          id={`${idPrefix}-period`}
          value={search.period}
          onChange={(event) => setSearch({ period: shape.period.parse(event.target.value) })}
        >
          {PERIODS.map((period) => (
            <option key={period} value={period}>
              {getPeriodOptionLabel(period, locale)}
            </option>
          ))}
        </Select>
      </Field>
      {search.period === 'custom' ? (
        <>
          <Field id={`${idPrefix}-from`} label={m.filter_from()}>
            <input
              id={`${idPrefix}-from`}
              type="date"
              value={search.from ?? ''}
              onChange={(event) => setSearch({ from: event.target.value || undefined })}
              className="h-8 rounded-md border border-line-strong bg-surface px-2 text-sm text-fg"
            />
          </Field>
          <Field id={`${idPrefix}-to`} label={m.filter_to()}>
            <input
              id={`${idPrefix}-to`}
              type="date"
              value={search.to ?? ''}
              onChange={(event) => setSearch({ to: event.target.value || undefined })}
              className="h-8 rounded-md border border-line-strong bg-surface px-2 text-sm text-fg"
            />
          </Field>
        </>
      ) : null}
      <Field id={`${idPrefix}-minmag`} label={m.filter_min_magnitude()}>
        <Select
          id={`${idPrefix}-minmag`}
          value={search.minmag}
          onChange={(event) =>
            setSearch({ minmag: shape.minmag.parse(Number(event.target.value)) })
          }
        >
          {MIN_MAGNITUDES.map((magnitude) => (
            <option key={magnitude} value={magnitude}>
              {getMinMagnitudeLabel(magnitude)}
            </option>
          ))}
        </Select>
      </Field>
      <SegmentedControl
        label={m.filter_source()}
        value={search.source}
        options={SOURCE_OPTIONS}
        onValueChange={(source) => setSearch({ source })}
      />
      <Button variant="ghost" onClick={() => setSearch(CLEARED_FILTERS)}>
        {m.clear_filters()}
      </Button>
    </div>
  );
}
