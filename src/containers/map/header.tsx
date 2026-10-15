import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { LanguageSwitch } from '@/containers/shell/language-switch';
import { ThemeSwitch } from '@/containers/shell/theme-switch';
import { TruncatedNotice } from '@/containers/shell/truncated-notice';
import { ViewTabs } from '@/containers/shell/view-tabs';
import { useEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { SOURCE_ADAPTERS, earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { getEarthquakeCountLabel } from '@/lib/i18n/earthquake-count';
import { getPeriodLabel } from '@/lib/i18n/labels';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

export function MapHeader() {
  const search = useEarthquakeSearch();
  const { data, isPending, isPlaceholderData, isError, dataUpdatedAt } = useQuery({
    ...earthquakesQueryOptions(search),
    placeholderData: keepPreviousData,
  });
  const locale = getLocale();
  const source = SOURCE_ADAPTERS[search.source].label;
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
    dataUpdatedAt,
  );
  const summary =
    data && !isPlaceholderData
      ? m.map_summary({
          count: getEarthquakeCountLabel(data.earthquakes.length, locale),
          period: getPeriodLabel(search, locale),
          minMagnitude: String(search.minmag),
          source,
          time,
        })
      : m.loading_earthquakes();

  return (
    <header className="absolute top-3 left-3 max-w-[calc(100%-1.5rem)] rounded-lg bg-canvas/70 px-3 py-2 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="text-base font-semibold tracking-tight whitespace-nowrap">
          {m.app_title()}
        </h1>
        <div className="flex items-center gap-2 sm:gap-3">
          <ViewTabs current="map" />
          <LanguageSwitch />
          <ThemeSwitch />
        </div>
      </div>
      {data ? (
        <p aria-live="polite" className="text-xs text-muted">
          {summary}
        </p>
      ) : null}
      {data?.isTruncated ? <TruncatedNotice className="max-w-sm border-0 px-0 py-1" /> : null}
      {isPending ? <p className="text-xs text-muted">{m.loading_earthquakes()}</p> : null}
      {isError ? (
        <p role="alert" className="text-xs text-alert">
          {m.error_source_retrying({ source })}
        </p>
      ) : null}
    </header>
  );
}
