import { useEffect } from 'react';
import { useMap } from 'react-map-gl/maplibre';

import { useEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { getWindowMs } from '@/lib/earthquakes/timeline';
import { getShouldPushT } from '@/lib/map/playback-clock';

import { usePlaybackClock } from './playback-context';

export function TimelineSync() {
  const { current: map } = useMap();
  const clock = usePlaybackClock();
  const { window: playbackWindow } = useEarthquakeSearch();

  useEffect(() => {
    if (!map) return;

    const windowMs = getWindowMs(playbackWindow);
    let lastPushMs: number | null = null;
    let lastT: number | null = null;
    let lastWindowStart: number | null = null;
    let lastWindowMs: number | null = null;

    const push = (t: number, playing: boolean) => {
      const windowStart = clock.getRange().start;
      const nowMs = performance.now();
      const isRangeChanged = windowStart !== lastWindowStart || windowMs !== lastWindowMs;

      if (isRangeChanged) {
        map.setGlobalStateProperty('windowStart', windowStart);
        map.setGlobalStateProperty('windowMs', windowMs);
        lastWindowStart = windowStart;
        lastWindowMs = windowMs;
      }

      const isDue = isRangeChanged || getShouldPushT({ lastPushMs, nowMs, isPlaying: playing });
      if (!isDue || t === lastT) return;
      map.setGlobalStateProperty('t', t);
      lastT = t;
      lastPushMs = nowMs;
    };

    const instance = map.getMap();
    let unsubscribe = () => {};
    const start = () => {
      push(clock.getT(), clock.isPlaying());
      unsubscribe = clock.subscribe(push);
    };

    if (instance.style?._loaded) start();
    else instance.once('style.load', start);

    return () => {
      instance.off('style.load', start);
      unsubscribe();
    };
  }, [map, clock, playbackWindow]);

  return null;
}
