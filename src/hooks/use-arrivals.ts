import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useEffect, useEffectEvent, useRef } from 'react';

import { getArrivedIds } from '@/lib/earthquakes/arrivals';
import { playbackClock } from '@/lib/earthquakes/playback-clock';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import type { Earthquake } from '@/lib/earthquakes/types';

type Refresh = { key: string; ids: ReadonlySet<string> };

const homeRoute = getRouteApi('/');

function getPreviousIds(previous: Refresh | null, key: string): ReadonlySet<string> | null {
  return previous?.key === key ? previous.ids : null;
}

export function useArrivals(onArrive: (arrived: readonly Earthquake[]) => void) {
  const search = homeRoute.useSearch();
  const filters = getEarthquakeFilters(search);
  const { data } = useQuery(earthquakesQueryOptions(filters));
  const refreshKey = JSON.stringify(filters);
  const refreshRef = useRef<Refresh | null>(null);
  const handleArrive = useEffectEvent(onArrive);

  useEffect(() => {
    if (data === undefined) return;
    const ids = data.earthquakes.map(({ id }) => id);
    const arrivedIds = getArrivedIds(getPreviousIds(refreshRef.current, refreshKey), ids);
    refreshRef.current = { key: refreshKey, ids: new Set(ids) };
    if (arrivedIds.size === 0 || playbackClock.getPlayhead() !== null) return;
    handleArrive(data.earthquakes.filter(({ id }) => arrivedIds.has(id)));
  }, [data, refreshKey]);
}
