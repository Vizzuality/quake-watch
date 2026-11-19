import type { Map as MapLibreMap } from 'maplibre-gl';

import { MAP_IMAGE_PIXEL_RATIO, getMapImages } from '@/lib/globe/map-images';

export function addMapImages(map: MapLibreMap) {
  for (const { id, width, height, data } of getMapImages()) {
    if (map.hasImage(id)) continue;
    map.addImage(id, { width, height, data }, { pixelRatio: MAP_IMAGE_PIXEL_RATIO });
  }
}
