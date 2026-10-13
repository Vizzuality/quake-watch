import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Layer, Source } from 'react-map-gl/maplibre';

import { CORE_LAYER, HALO_LAYER, QUAKE_SOURCE_ID } from '@/components/map/layers';
import { useEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { getEarthquakesGeoJson } from '@/lib/earthquakes/magnitude';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';

export function EarthquakesLayer() {
  const search = useEarthquakeSearch();
  const { data } = useQuery({
    ...earthquakesQueryOptions(search),
    placeholderData: keepPreviousData,
  });
  const earthquakes = data?.earthquakes;
  const geojson = useMemo(() => getEarthquakesGeoJson(earthquakes ?? []), [earthquakes]);

  return (
    <Source id={QUAKE_SOURCE_ID} type="geojson" data={geojson}>
      <Layer {...HALO_LAYER} />
      <Layer {...CORE_LAYER} />
    </Source>
  );
}
