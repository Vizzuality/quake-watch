import { QuakeMap } from '@/components/map/quake-map';
import { useEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { SOURCE_ADAPTERS } from '@/lib/earthquakes/query-options';
import { m } from '@/paraglide/messages';

import { EarthquakesLayer } from './earthquakes-layer';
import { EpicenterTooltip } from './epicenter-tooltip';
import { MapHeader } from './header';
import { MagnitudeLegend } from './legend';
import { PlaybackProvider } from './playback-context';
import { RingTooltip } from './ring-tooltip';
import { SearchAreaLayer } from './search-area-layer';
import { SearchCamera } from './search-camera';
import { ShakingWaves } from './shaking-waves';
import { TimelineSync } from './timeline-sync';
import { Timeline } from './timeline/timeline';

export function MapLayout() {
  const search = useEarthquakeSearch();

  return (
    <PlaybackProvider>
      <main className="relative h-dvh w-full overflow-hidden">
        <QuakeMap
          attribution={m.attribution_data({ source: SOURCE_ADAPTERS[search.source].label })}
        >
          <EarthquakesLayer />
          <SearchAreaLayer />
          <SearchCamera />
          <TimelineSync />
          <ShakingWaves />
          <RingTooltip />
          <EpicenterTooltip />
        </QuakeMap>
        <MapHeader />
        <MagnitudeLegend />
        <Timeline />
      </main>
    </PlaybackProvider>
  );
}
