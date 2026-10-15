import { useMemo } from 'react';
import { Layer, Source } from 'react-map-gl/maplibre';

import {
  HALO_LAYER_ID,
  SEARCH_AREA_SOURCE_ID,
  getPlaceOfInterestLayer,
  getSearchAreaLineLayer,
} from '@/components/map/layers';
import { useEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { useMapPalette } from '@/hooks/use-theme';
import { getSearchAreaGeoJson } from '@/lib/map/search-area';

export function SearchAreaLayer() {
  const { lat, lon, radius } = useEarthquakeSearch();
  const palette = useMapPalette();
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
      <Layer {...getSearchAreaLineLayer(palette)} beforeId={HALO_LAYER_ID} />
      <Layer {...getPlaceOfInterestLayer(palette)} beforeId={HALO_LAYER_ID} />
    </Source>
  );
}
