import { SearchXIcon } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useEarthquakeSearch, useSetEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { getWiderPeriod, getWiderRadius } from '@/lib/earthquakes/filters';
import { SOURCE_ADAPTERS } from '@/lib/earthquakes/query-options';
import { SOURCES, getSearchCenter } from '@/lib/earthquakes/search-schema';
import { getKmLabel } from '@/lib/format';
import { getPeriodLabel } from '@/lib/i18n/labels';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

export function SourceErrorAlert({
  sourceLabel,
  onRetry,
}: {
  sourceLabel: string;
  onRetry: () => void;
}) {
  const search = useEarthquakeSearch();
  const setSearch = useSetEarthquakeSearch();
  const otherSource = SOURCES.find((source) => source !== search.source)!;
  const otherSourceLabel = SOURCE_ADAPTERS[otherSource].label;

  return (
    <Alert
      hint={m.error_source_hint({ source: otherSourceLabel })}
      action={
        <>
          <Button onClick={onRetry}>{m.retry()}</Button>
          <Button variant="ghost" onClick={() => setSearch({ source: otherSource })}>
            {m.error_try_source({ source: otherSourceLabel })}
          </Button>
        </>
      }
    >
      {m.error_source_unreachable({ source: sourceLabel })}
    </Alert>
  );
}

export function WidenActions({ className }: { className?: string }) {
  const search = useEarthquakeSearch();
  const setSearch = useSetEarthquakeSearch();
  const locale = getLocale();
  const widerRadius = getSearchCenter(search) ? getWiderRadius(search.radius) : null;
  const widerPeriod = getWiderPeriod(search.period);

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {widerRadius ? (
        <Button onClick={() => setSearch({ radius: widerRadius })}>
          {m.widen_radius({ radius: getKmLabel(widerRadius, locale) })}
        </Button>
      ) : null}
      {widerPeriod ? (
        <Button onClick={() => setSearch({ period: widerPeriod })}>
          {m.widen_period({ period: getPeriodLabel({ ...search, period: widerPeriod }, locale) })}
        </Button>
      ) : null}
    </div>
  );
}

export function NoResults() {
  return (
    <div className="flex flex-col items-start gap-4 border-y border-line py-10 sm:items-center sm:text-center">
      <SearchXIcon aria-hidden="true" className="size-6 text-muted" />
      <div className="flex flex-col gap-1">
        <p className="text-base font-medium text-balance">{m.no_results_title()}</p>
        <p className="text-sm text-muted">{m.no_results_hint()}</p>
      </div>
      <WidenActions className="sm:justify-center" />
    </div>
  );
}

export function MeaningFootnote() {
  return <p className="max-w-prose text-xs text-muted">{m.meaning_footnote()}</p>;
}
