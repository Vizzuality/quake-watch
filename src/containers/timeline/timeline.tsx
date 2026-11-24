import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { playbackClock } from '@/lib/earthquakes/playback-clock';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import { getRingOpacity } from '@/lib/earthquakes/time-ring';
import { getIntervalRange } from '@/lib/earthquakes/timeline';
import {
  getIsHomeSheetOpen,
  getIsHomeSheetOpenOnServer,
  subscribeHomeSheet,
} from '@/lib/layout/home-sheet-store';
import { cn } from '@/lib/utils';

import { PlaybackControl } from './playback-control';
import { TimeRing } from './time-ring';

const homeRoute = getRouteApi('/');

function getRingLayerClassName(isSheetOpen: boolean): string {
  return cn(
    'pointer-events-none absolute inset-0 motion-safe:[transition:opacity_300ms_ease-out,visibility_300ms]',
    isSheetOpen && 'invisible opacity-0 short:visible short:opacity-100 md:visible md:opacity-100',
  );
}

export function Timeline() {
  const search = homeRoute.useSearch();
  const { data } = useQuery(earthquakesQueryOptions(getEarthquakeFilters(search)));
  const isSheetOpen = useSyncExternalStore(
    subscribeHomeSheet,
    getIsHomeSheetOpen,
    getIsHomeSheetOpenOnServer,
  );
  const fetchedAt = data?.fetchedAt;
  const { interval, quake } = search;
  const range = useMemo(
    () => (fetchedAt === undefined ? null : getIntervalRange(interval, fetchedAt)),
    [interval, fetchedAt],
  );

  useEffect(() => {
    playbackClock.setRange(range);
  }, [range]);

  useEffect(() => {
    if (quake !== undefined) playbackClock.goLive();
  }, [quake]);

  useEffect(() => () => playbackClock.pause(), []);

  if (quake !== undefined) return null;
  return (
    <div className={getRingLayerClassName(isSheetOpen)}>
      <TimeRing opacity={getRingOpacity(search.zoom)} />
      <PlaybackControl />
    </div>
  );
}
