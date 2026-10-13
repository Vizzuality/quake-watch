import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useMap } from 'react-map-gl/maplibre';

import { HALO_LAYER } from '@/components/map/layers';
import { getShakingWavesLayer } from '@/components/map/shaking-waves-layer';
import { useEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { getLoadedRange, getWindowMs } from '@/lib/earthquakes/timeline';
import { getPlaybackSpanMs, getWaveInstances, getWaveSpanMs } from '@/lib/map/shaking-waves';

import { usePlaybackClock } from './playback-context';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function ShakingWaves() {
  const { current: map } = useMap();
  const clock = usePlaybackClock();
  const search = useEarthquakeSearch();
  const { data } = useQuery({
    ...earthquakesQueryOptions(search),
    placeholderData: keepPreviousData,
  });
  const playbackWindow = search.window;
  const instances = useMemo(() => {
    const earthquakes = data?.earthquakes ?? [];
    return getWaveInstances(earthquakes, getLoadedRange(earthquakes)?.start ?? 0);
  }, [data]);
  const [waves] = useState(() => getShakingWavesLayer());

  useEffect(() => {
    if (!map) return;
    const instance = map.getMap();
    const { id } = waves.layer;

    const placeLayer = () => {
      if (!instance.style?._loaded || !instance.getLayer(HALO_LAYER.id)) return;
      if (!instance.getLayer(id)) {
        instance.addLayer(waves.layer, HALO_LAYER.id);
        return;
      }
      const order = instance.getLayersOrder();
      if (order[order.indexOf(HALO_LAYER.id) - 1] !== id) instance.moveLayer(id, HALO_LAYER.id);
    };

    placeLayer();
    instance.on('styledata', placeLayer);
    return () => {
      instance.off('styledata', placeLayer);
      if (instance.style?._loaded && instance.getLayer(id)) instance.removeLayer(id);
    };
  }, [map, waves]);

  useEffect(() => {
    waves.setInstances(instances);
    map?.triggerRepaint();
  }, [map, waves, instances]);

  useEffect(() => {
    if (!map) return;
    const windowMs = getWindowMs(playbackWindow);
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);

    const pushFrame = () => {
      waves.setFrame({
        tMs: clock.getT(),
        waveSpanMs: getWaveSpanMs(getPlaybackSpanMs(clock.getRange(), windowMs)),
        reducedMotion: reducedMotion.matches,
      });
      map.triggerRepaint();
    };

    pushFrame();
    reducedMotion.addEventListener('change', pushFrame);
    const unsubscribe = clock.subscribe(pushFrame);
    return () => {
      reducedMotion.removeEventListener('change', pushFrame);
      unsubscribe();
    };
  }, [map, clock, waves, playbackWindow]);

  return null;
}
