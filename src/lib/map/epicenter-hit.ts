import type { Map as MaplibreMap, PointLike } from 'maplibre-gl';

import { CORE_LAYER_ID } from '@/components/map/layers';

import type { PlaybackClock } from './playback-clock';

type EpicenterMap = Pick<MaplibreMap, 'getLayer' | 'queryRenderedFeatures'>;
type EpicenterClock = Pick<PlaybackClock, 'getRange' | 'getT'>;

export function getIsEpicenterVisible(time: number, clock: EpicenterClock): boolean {
  return time >= clock.getRange().start && time <= clock.getT();
}

export function getVisibleEpicenterId(
  map: EpicenterMap,
  point: PointLike,
  clock: EpicenterClock,
): string | null {
  if (!map.getLayer(CORE_LAYER_ID)) return null;
  const features = map.queryRenderedFeatures(point, { layers: [CORE_LAYER_ID] });
  const visible = features.find(({ properties }) => getIsEpicenterVisible(properties.time, clock));
  return visible ? String(visible.properties.id) : null;
}
