import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import {
  getIsLiveUpdatesPaused,
  getIsLiveUpdatesPausedOnServer,
  setLiveUpdatesPaused,
  subscribeLiveUpdates,
} from '@/lib/earthquakes/live-updates';

const EARTHQUAKES_QUERY_ROOT = ['earthquakes'];

function stopLiveRefetch(queryClient: QueryClient) {
  // An observer only re-reads a function `refetchInterval` when its options or its query change.
  for (const query of queryClient.getQueryCache().findAll({ queryKey: EARTHQUAKES_QUERY_ROOT })) {
    for (const observer of query.observers) observer.setOptions(observer.options);
  }
}

export function useIsLiveUpdatesPaused(): boolean {
  return useSyncExternalStore(
    subscribeLiveUpdates,
    getIsLiveUpdatesPaused,
    getIsLiveUpdatesPausedOnServer,
  );
}

export function useToggleLiveUpdates(): () => void {
  const queryClient = useQueryClient();

  return () => {
    const isPausing = !getIsLiveUpdatesPaused();
    setLiveUpdatesPaused(isPausing);
    if (isPausing) {
      stopLiveRefetch(queryClient);
      return;
    }
    void queryClient.refetchQueries({ queryKey: EARTHQUAKES_QUERY_ROOT, type: 'active' });
  };
}
