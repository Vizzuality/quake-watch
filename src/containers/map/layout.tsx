import { QuakeMap } from '@/components/map/quake-map';
import { useEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { SOURCE_ADAPTERS } from '@/lib/earthquakes/query-options';
import { m } from '@/paraglide/messages';

import { EarthquakesLayer } from './earthquakes-layer';
import { MapHeader } from './header';
import { MagnitudeLegend } from './legend';

export function MapLayout() {
  const search = useEarthquakeSearch();

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <QuakeMap attribution={m.attribution_data({ source: SOURCE_ADAPTERS[search.source].label })}>
        <EarthquakesLayer />
      </QuakeMap>
      <MapHeader />
      <MagnitudeLegend />
    </main>
  );
}
