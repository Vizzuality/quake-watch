import { useMemo } from 'react';
import { Layer, Source } from 'react-map-gl/maplibre';

import {
  PLACE_OF_INTEREST_LAYER,
  SEARCH_AREA_LINE_LAYER,
  SEARCH_AREA_SOURCE_ID,
} from '@/components/map/layers';
import { useEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { getSearchAreaGeoJson } from '@/lib/map/search-area';

export function SearchAreaLayer() {
  const { lat, lon, radius } = useEarthquakeSearch();
  const geojson = useMemo(
    () =>
      lat === undefined || lon === undefined
        ? null
        : getSearchAreaGeoJson({ latitude: lat, longitude: lon }, radius),
    [lat, lon, radius],
  );

  if (!geojson) return null;

  return (
    <Source id={SEARCH_AREA_SOURCE_ID} type="geojson" data={geojson}>
      <Layer {...SEARCH_AREA_LINE_LAYER} beforeId="earthquakes-halo" />
      <Layer {...PLACE_OF_INTEREST_LAYER} beforeId="earthquakes-halo" />
    </Source>
  );
}
