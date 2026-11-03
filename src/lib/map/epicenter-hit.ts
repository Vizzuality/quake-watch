import { Point } from 'maplibre-gl';
import type { MapGeoJSONFeature, Map as MaplibreMap, PointLike } from 'maplibre-gl';

import { CORE_LAYER_ID } from '@/components/map/layers';

import type { PlaybackClock } from './playback-clock';

export const EPICENTER_TAP_RADIUS_PX = 12;

type EpicenterMap = Pick<
  MaplibreMap,
  'getLayer' | 'project' | 'queryRenderedFeatures' | 'unproject'
>;
type EpicenterClock = Pick<PlaybackClock, 'getRange' | 'getT'>;
type EpicenterHitOptions = { hitRadiusPx?: number };

export function getIsEpicenterVisible(time: number, clock: EpicenterClock): boolean {
  return time >= clock.getRange().start && time <= clock.getT();
}

function getVisibleFeatures(
  features: MapGeoJSONFeature[],
  clock: EpicenterClock,
): MapGeoJSONFeature[] {
  return features.filter(({ properties }) => getIsEpicenterVisible(properties.time, clock));
}

function getNearestFeature(
  map: EpicenterMap,
  pointer: Point,
  features: MapGeoJSONFeature[],
): MapGeoJSONFeature | null {
  const pointerLng = map.unproject(pointer).lng;
  let nearest: MapGeoJSONFeature | null = null;
  let nearestDistance = Infinity;
  for (const feature of features) {
    if (feature.geometry.type !== 'Point') continue;
    const [lng, lat] = feature.geometry.coordinates;
    const copyLng = lng + 360 * Math.round((pointerLng - lng) / 360);
    const distance = pointer.dist(Point.convert(map.project([copyLng, lat])));
    if (distance < nearestDistance) {
      nearest = feature;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function getVisibleEpicenterId(
  map: EpicenterMap,
  point: PointLike,
  clock: EpicenterClock,
  { hitRadiusPx = 0 }: EpicenterHitOptions = {},
): string | null {
  if (!map.getLayer(CORE_LAYER_ID)) return null;
  const layers = [CORE_LAYER_ID];
  const [exact] = getVisibleFeatures(map.queryRenderedFeatures(point, { layers }), clock);
  if (exact) return String(exact.properties.id);
  if (hitRadiusPx <= 0) return null;
  const { x, y } = Point.convert(point);
  const box = map.queryRenderedFeatures(
    [
      [x - hitRadiusPx, y - hitRadiusPx],
      [x + hitRadiusPx, y + hitRadiusPx],
    ],
    { layers },
  );
  const nearest = getNearestFeature(map, new Point(x, y), getVisibleFeatures(box, clock));
  return nearest ? String(nearest.properties.id) : null;
}
