import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Layer, Source } from 'react-map-gl/maplibre';

import { QUAKE_SOURCE_ID, getCoreLayer, getHaloLayer } from '@/components/map/layers';
import { useEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { useMapPalette } from '@/hooks/use-theme';
import { getEarthquakesGeoJson } from '@/lib/earthquakes/magnitude';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';

export function EarthquakesLayer() {
  const search = useEarthquakeSearch();
  const palette = useMapPalette();
  const { data } = useQuery({
    ...earthquakesQueryOptions(search),
    placeholderData: keepPreviousData,
  });
  const earthquakes = data?.earthquakes;
  const geojson = useMemo(() => getEarthquakesGeoJson(earthquakes ?? []), [earthquakes]);

  return (
    <Source id={QUAKE_SOURCE_ID} type="geojson" data={geojson}>
      <Layer {...getHaloLayer(palette)} />
      <Layer {...getCoreLayer(palette)} />
    </Source>
  );
}
