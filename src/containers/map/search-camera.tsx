import { useEffect } from 'react';
import { useMap } from 'react-map-gl/maplibre';

import { useEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { getSearchBounds } from '@/lib/map/search-bounds';

const FIT_PADDING = 48;

export function SearchCamera() {
  const { current: map } = useMap();
  const { lat, lon, radius } = useEarthquakeSearch();

  useEffect(() => {
    if (!map || lat === undefined || lon === undefined) return;
    const camera = map.cameraForBounds(getSearchBounds({ latitude: lat, longitude: lon }, radius), {
      padding: FIT_PADDING,
    });
    if (camera) map.flyTo(camera);
  }, [map, lat, lon, radius]);

  return null;
}
