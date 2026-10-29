import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { Skeleton } from '@/components/ui/skeleton';
import { ClientOnlyText } from '@/containers/earthquake-detail/shared/client-only-text';
import { MeaningFootnote } from '@/containers/search/states';
import { useEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { SOURCE_ADAPTERS, earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { getSearchCenter } from '@/lib/earthquakes/search-schema';
import type { EarthquakeSearch } from '@/lib/earthquakes/search-schema';
import { getClockTimeLabel, getKmLabel } from '@/lib/format';
import { getEarthquakeCountLabel } from '@/lib/i18n/earthquake-count';
import { getPeriodLabel } from '@/lib/i18n/labels';
import { getClockTimePlaceholder } from '@/lib/time-placeholder';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';
import { getLocale } from '@/paraglide/runtime';

export function getSummaryHeadline(
  search: EarthquakeSearch,
  count: number,
  locale: Locale,
): string {
  const countLabel = getEarthquakeCountLabel(count, locale);
  if (!getSearchCenter(search)) return m.summary_headline_world({ count: countLabel });
  const radius = getKmLabel(search.radius, locale);
  if (search.place === undefined) {
    return m.summary_headline_near_point({ count: countLabel, radius });
  }
  return m.summary_headline_near({ count: countLabel, radius, place: search.place });
}

export function LiveMarker() {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-fg">
      <span aria-hidden="true" className="relative flex size-2">
        <span className="absolute inset-0 rounded-full bg-mag-4 motion-safe:animate-ping motion-safe:opacity-60" />
        <span className="relative size-2 rounded-full bg-mag-4" />
      </span>
      {m.live_label()}
      <span className="font-normal text-muted">· {m.live_explain()}</span>
    </span>
  );
}

export function SearchSummary() {
  const search = useEarthquakeSearch();
  const { data, isPlaceholderData, isError, dataUpdatedAt } = useQuery({
    ...earthquakesQueryOptions(search),
    placeholderData: keepPreviousData,
  });
  const locale = getLocale();

  if (!data && isError) return null;

  if (!data) {
    return (
      <div aria-hidden="true" className="flex flex-col gap-2 py-1">
        <Skeleton className="h-6 w-72 max-w-full" />
        <Skeleton className="h-3.5 w-56 max-w-full" />
      </div>
    );
  }

  if (isPlaceholderData) {
    return (
      <p aria-live="polite" aria-busy className="py-1 text-lg text-muted">
        {m.loading_earthquakes()}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p aria-live="polite" className="text-lg font-medium tracking-tight text-balance sm:text-xl">
        {getSummaryHeadline(search, data.earthquakes.length, locale)}
      </p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span>
          {m.summary_meta({
            period: getPeriodLabel(search, locale),
            source: SOURCE_ADAPTERS[search.source].label,
          })}
          {' · '}
          <ClientOnlyText
            placeholder={m.summary_updated({
              time: getClockTimePlaceholder(dataUpdatedAt, locale),
            })}
          >
            {m.summary_updated({ time: getClockTimeLabel(dataUpdatedAt, locale) })}
          </ClientOnlyText>
        </span>
        {search.period === '24h' && !isError ? <LiveMarker /> : null}
      </p>
      <MeaningFootnote />
    </div>
  );
}
