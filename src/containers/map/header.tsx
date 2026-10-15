import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { Wordmark } from '@/components/brand/wordmark';
import { Skeleton } from '@/components/ui/skeleton';
import { SourceErrorAlert, WidenActions } from '@/containers/search/states';
import { LiveMarker, getSummaryHeadline } from '@/containers/search/summary';
import { FiltersSheet } from '@/containers/search/toolbar';
import { LanguageSwitch } from '@/containers/shell/language-switch';
import { ThemeSwitch } from '@/containers/shell/theme-switch';
import { TruncatedNotice } from '@/containers/shell/truncated-notice';
import { ViewTabs } from '@/containers/shell/view-tabs';
import { useEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { SOURCE_ADAPTERS, earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import type { EarthquakeSearch, PlaybackWindow } from '@/lib/earthquakes/search-schema';
import { getTimelineRange } from '@/lib/earthquakes/timeline';
import {
  getEffectiveWindow,
  getPlaybackWindowCount,
  getWindowEnd,
} from '@/lib/earthquakes/timeline-view';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getEarthquakeCountLabel } from '@/lib/i18n/earthquake-count';
import { getPeriodLabel } from '@/lib/i18n/labels';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';
import type { Locale } from '@/paraglide/runtime';

function DisplaySettings() {
  return (
    <section
      aria-labelledby="map-settings-title"
      className="mt-6 flex flex-col gap-3 border-t border-line pt-4 sm:hidden"
    >
      <h3 id="map-settings-title" className="text-sm font-semibold">
        {m.settings_title()}
      </h3>
      <div className="flex items-center gap-4">
        <LanguageSwitch />
        <ThemeSwitch />
      </div>
    </section>
  );
}

const WINDOW_PERIOD_LABELS: Record<PlaybackWindow, () => string> = {
  '24h': m.period_24h,
  '7d': m.period_7d,
};

function getShownLabel(
  earthquakes: Earthquake[],
  search: EarthquakeSearch,
  fetchedAt: number,
  locale: Locale,
): string | null {
  if (search.period === '24h') return null;
  const loaded = getTimelineRange({ earthquakes, search, nowMs: fetchedAt });
  const windowEnd = getWindowEnd({ loaded, t: search.t, override: null, key: '' });
  if (!loaded || windowEnd === null) return null;
  const window = getEffectiveWindow(search.period, search.window);
  const count = getPlaybackWindowCount({
    times: earthquakes.map(({ time }) => time),
    loaded,
    window,
    windowEnd,
  });
  return m.map_shown({
    count: getEarthquakeCountLabel(count, locale),
    window: WINDOW_PERIOD_LABELS[window](),
  });
}

function MapSummary() {
  const search = useEarthquakeSearch();
  const { data, isPlaceholderData, isError, refetch, dataUpdatedAt } = useQuery({
    ...earthquakesQueryOptions(search),
    placeholderData: keepPreviousData,
  });
  const locale = getLocale();
  const sourceLabel = SOURCE_ADAPTERS[search.source].label;

  if (isError && !data) {
    return <SourceErrorAlert sourceLabel={sourceLabel} onRetry={() => void refetch()} />;
  }
  if (!data) {
    return (
      <div aria-hidden="true" className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </div>
    );
  }
  if (isPlaceholderData) {
    return (
      <p aria-live="polite" aria-busy className="text-sm text-muted">
        {m.loading_earthquakes()}
      </p>
    );
  }

  const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(
    dataUpdatedAt,
  );
  const isEmpty = data.earthquakes.length === 0;
  const shownLabel = isEmpty
    ? null
    : getShownLabel(data.earthquakes, search, data.fetchedAt, locale);

  return (
    <div className="flex flex-col gap-1.5">
      <p aria-live="polite" className="text-sm font-medium text-balance">
        {isEmpty
          ? m.no_results_title()
          : getSummaryHeadline(search, data.earthquakes.length, locale)}
      </p>
      {shownLabel ? <p className="text-sm text-fg">{shownLabel}</p> : null}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span>
          {m.map_meta({
            period: getPeriodLabel(search, locale),
            minMagnitude: String(search.minmag),
            source: sourceLabel,
            time,
          })}
        </span>
        {search.period === '24h' && !isError ? <LiveMarker /> : null}
      </p>
      {isError ? (
        <SourceErrorAlert sourceLabel={sourceLabel} onRetry={() => void refetch()} />
      ) : null}
      {isEmpty ? <WidenActions className="gap-1.5 [&>*]:h-8 [&>*]:px-2.5 [&>*]:text-xs" /> : null}
      {data.isTruncated ? <TruncatedNotice className="border-0 px-0 py-0" /> : null}
    </div>
  );
}

export function MapHeader() {
  return (
    <header className="absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex flex-col gap-2.5 rounded-md border border-line bg-canvas/90 px-3 py-2.5 backdrop-blur sm:right-auto sm:w-md">
      <div className="flex items-center justify-between gap-3">
        <Wordmark />
        <div className="flex items-center gap-2">
          <ViewTabs current="map" />
          <FiltersSheet
            idPrefix="map-sheet"
            triggerClassName="px-3 sm:h-8"
            labelClassName="sr-only md:not-sr-only"
          >
            <DisplaySettings />
          </FiltersSheet>
        </div>
      </div>
      <MapSummary />
      <div className="hidden items-center gap-4 border-t border-line pt-2 sm:flex">
        <LanguageSwitch />
        <ThemeSwitch />
      </div>
    </header>
  );
}
