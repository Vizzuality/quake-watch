import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';

import { playbackClock } from '@/lib/earthquakes/playback-clock';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import { getRingOpacity } from '@/lib/earthquakes/time-ring';
import { getIntervalRange } from '@/lib/earthquakes/timeline';

import { PlaybackControl } from './playback-control';
import { TimeRing } from './time-ring';

const homeRoute = getRouteApi('/');

export function Timeline() {
  const search = homeRoute.useSearch();
  const { data } = useQuery(earthquakesQueryOptions(getEarthquakeFilters(search)));
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
    <div className="pointer-events-none absolute inset-0">
      <TimeRing opacity={getRingOpacity(search.zoom)} />
      <PlaybackControl />
    </div>
  );
}
