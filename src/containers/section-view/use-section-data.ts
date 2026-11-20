import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useMemo } from 'react';

import { getSelectedEarthquake } from '@/containers/globe/use-hovered-quake';
import {
  earthquakeDetailQueryOptions,
  getDetailEarthquake,
} from '@/lib/earthquakes/details/query-options';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import type { Earthquake } from '@/lib/earthquakes/types';
import { type CrustGrid, getCrustColumn } from '@/lib/section/crust-layers';
import {
  crustLayersQueryOptions,
  reliefQueryOptions,
  slabGridsQueryOptions,
} from '@/lib/section/query-options';
import { type SectionModel, getSectionModel } from '@/lib/section/section-model';
import { type SlabGrid, getSlabDepthKm } from '@/lib/section/slab-depth';

const homeRoute = getRouteApi('/');
const EMPTY_EARTHQUAKES: readonly Earthquake[] = [];
const EMPTY_SLABS: readonly SlabGrid[] = [];

type SectionData = {
  earthquake: Earthquake;
  elevationsM: Float32Array[];
  crust: CrustGrid;
  slabs: readonly SlabGrid[];
  others: readonly Earthquake[];
};

function getModel({ earthquake, elevationsM, crust, slabs, others }: SectionData): SectionModel {
  return getSectionModel({
    earthquake,
    elevationsM,
    getCrust: (lon, lat) => getCrustColumn(crust, lat, lon),
    getSlabDepthKm: (lon, lat) => getSlabDepthKm(slabs, lat, lon),
    others,
  });
}

export function useSectionData(quake: string) {
  const search = homeRoute.useSearch();
  const { data: list } = useQuery(earthquakesQueryOptions(getEarthquakeFilters(search)));
  const { data: detail } = useQuery(earthquakeDetailQueryOptions(quake));
  const earthquakes = list?.earthquakes ?? EMPTY_EARTHQUAKES;
  const earthquake =
    getSelectedEarthquake(earthquakes, quake) ?? getDetailEarthquake(detail ?? null);
  const relief = useQuery({
    ...reliefQueryOptions(earthquake?.latitude ?? 0, earthquake?.longitude ?? 0),
    enabled: earthquake !== null,
  });
  const crust = useQuery(crustLayersQueryOptions());
  const slabs = useQuery(slabGridsQueryOptions());
  const isSlabSettled = slabs.isSuccess || slabs.isError;
  const model = useMemo(() => {
    if (!earthquake || !relief.data || !crust.data || !isSlabSettled) return null;
    return getModel({
      earthquake,
      elevationsM: relief.data,
      crust: crust.data,
      slabs: slabs.data ?? EMPTY_SLABS,
      others: earthquakes,
    });
  }, [earthquake, relief.data, crust.data, slabs.data, isSlabSettled, earthquakes]);

  function retry() {
    if (relief.isError) void relief.refetch();
    if (crust.isError) void crust.refetch();
  }

  return {
    earthquake,
    model,
    isError: relief.isError || crust.isError,
    isFetching: relief.isFetching || crust.isFetching,
    retry,
  };
}
