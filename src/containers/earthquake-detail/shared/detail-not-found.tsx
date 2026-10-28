import { QuakeNotFound } from '@/containers/not-found/quake-not-found';
import { SOURCE_ADAPTERS } from '@/lib/earthquakes/query-options';
import type { EarthquakeSource } from '@/lib/earthquakes/search-schema';
import { m } from '@/paraglide/messages';

export function DetailNotFound({ source }: { source: EarthquakeSource }) {
  return (
    <QuakeNotFound
      source={source}
      title={m.detail_not_found_title()}
      body={m.detail_not_found_body({ agency: SOURCE_ADAPTERS[source].label })}
      hasHomeLink={false}
    />
  );
}
