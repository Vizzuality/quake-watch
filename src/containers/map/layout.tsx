import { lazy, useState } from 'react';

import { LazyMapBoundary, type MapPlaceholderProps } from '@/components/map/lazy-map-boundary';

import { MapHeader } from './header';
import { getMapSurfaceModule } from './map-surface-module';
import { PlaybackProvider } from './playback-context';
import { Timeline } from './timeline/timeline';

function getMapSurfaceComponent() {
  return lazy(() => getMapSurfaceModule().then(({ MapSurface }) => ({ default: MapSurface })));
}

function MapPlaceholder({ children }: MapPlaceholderProps) {
  return <div className="absolute inset-0 flex items-center justify-center p-4">{children}</div>;
}

export function MapLayout() {
  const [MapSurface] = useState(getMapSurfaceComponent);

  return (
    <PlaybackProvider>
      <main className="relative h-dvh w-full overflow-hidden">
        <MapHeader />
        <LazyMapBoundary placeholder={MapPlaceholder}>
          <MapSurface />
        </LazyMapBoundary>
        <Timeline />
      </main>
    </PlaybackProvider>
  );
}
