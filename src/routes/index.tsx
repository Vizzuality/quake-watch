import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { QuakeMap } from '@/components/map/quake-map';
import { MagnitudeLegend } from '@/containers/map/legend';
import { LanguageSwitch } from '@/containers/shell/language-switch';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { EARTHQUAKE_SEARCH_DEFAULTS } from '@/lib/earthquakes/search-schema';
import { getEarthquakeCountLabel } from '@/lib/i18n/earthquake-count';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

export const Route = createFileRoute('/')({
  ssr: false,
  component: Home,
});

function Home() {
  const { data, isPending, isError, dataUpdatedAt } = useQuery(
    earthquakesQueryOptions(EARTHQUAKE_SEARCH_DEFAULTS),
  );

  const earthquakes = data?.earthquakes ?? [];
  const locale = getLocale();
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
  const summary = m.map_summary({
    count: getEarthquakeCountLabel(earthquakes.length, locale),
    time: timeFormat.format(dataUpdatedAt),
  });

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <QuakeMap earthquakes={earthquakes} />
      <header className="absolute top-3 left-3 max-w-[calc(100%-1.5rem)] rounded-lg bg-ink/70 px-3 py-2 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-base font-semibold tracking-tight">{m.app_title()}</h1>
          <LanguageSwitch />
        </div>
        {data ? (
          <p aria-live="polite" className="text-xs text-muted">
            {summary}
          </p>
        ) : null}
        {isPending ? <p className="text-xs text-muted">{m.loading_earthquakes()}</p> : null}
        {isError ? (
          <p role="alert" className="text-xs text-red-400">
            {m.error_source_retrying({ source: 'USGS' })}
          </p>
        ) : null}
      </header>
      <MagnitudeLegend />
    </main>
  );
}
