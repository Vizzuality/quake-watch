import { useEffect } from 'react';
import { useMap } from 'react-map-gl/maplibre';

import { useEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { getOverlayFitPadding } from '@/lib/map/fit-padding';
import { getSearchBounds } from '@/lib/map/search-bounds';

const FIT_GAP = 24;

function getOverlayRect(name: 'top' | 'bottom'): DOMRect | null {
  return document.querySelector(`[data-map-overlay="${name}"]`)?.getBoundingClientRect() ?? null;
}

export function SearchCamera() {
  const { current: map } = useMap();
  const { lat, lon, radius } = useEarthquakeSearch();

  useEffect(() => {
    if (!map || lat === undefined || lon === undefined) return;
    const padding = getOverlayFitPadding({
      map: map.getContainer().getBoundingClientRect(),
      top: getOverlayRect('top'),
      bottom: getOverlayRect('bottom'),
      gap: FIT_GAP,
    });
    const camera = map.cameraForBounds(getSearchBounds({ latitude: lat, longitude: lon }, radius), {
      padding,
    });
    if (camera) map.flyTo(camera);
  }, [map, lat, lon, radius]);

  return null;
}
