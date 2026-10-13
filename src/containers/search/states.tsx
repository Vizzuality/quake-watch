import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useEarthquakeSearch, useSetEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { getWiderPeriod, getWiderRadius } from '@/lib/earthquakes/filters';
import { EARTHQUAKE_LIMIT } from '@/lib/earthquakes/query-options';
import { getSearchCenter } from '@/lib/earthquakes/search-schema';
import { getKmLabel } from '@/lib/format';
import { getPeriodLabel } from '@/lib/i18n/labels';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

export function SourceErrorAlert({
  sourceLabel,
  onRetry,
}: {
  sourceLabel: string;
  onRetry: () => void;
}) {
  return (
    <Alert action={<Button onClick={onRetry}>{m.retry()}</Button>}>
      {m.error_source_unreachable({ source: sourceLabel })}
    </Alert>
  );
}

export function TruncatedNotice() {
  const limit = new Intl.NumberFormat(getLocale()).format(EARTHQUAKE_LIMIT);
  return (
    <p className="rounded-lg border border-line px-3 py-2 text-xs text-muted">
      {m.truncated_notice({ limit })}
    </p>
  );
}

export function NoResults() {
  const search = useEarthquakeSearch();
  const setSearch = useSetEarthquakeSearch();
  const locale = getLocale();
  const widerRadius = getSearchCenter(search) ? getWiderRadius(search.radius) : null;
  const widerPeriod = getWiderPeriod(search.period);

  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-sm">{m.no_results_title()}</p>
      <div className="flex flex-wrap justify-center gap-2">
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
    </div>
  );
}
