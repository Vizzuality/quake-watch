import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  BLOCK_SEGMENTS,
  type GeoPoint,
  getElevationGrid,
  type TilePixels,
} from '@/lib/crust/scene';
import { getTerrariumTiles, getTerrariumZoom } from '@/lib/crust/terrarium';
import { terrariumTileQueryOptions } from '@/lib/crust/terrarium-query-options';

function getTilePixels(results: UseQueryResult<TilePixels>[]): TilePixels[] | null {
  const pixels = results.flatMap((result) => (result.isSuccess ? [result.data] : []));
  return pixels.length === results.length ? pixels : null;
}

export function useRelief({ latitude, longitude }: GeoPoint, sideKm: number) {
  const tiles = getTerrariumTiles(latitude, longitude, sideKm, getTerrariumZoom(sideKm, latitude));
  const pixels = useQueries({
    queries: tiles.map(terrariumTileQueryOptions),
    combine: getTilePixels,
  });
  return useMemo(
    () => pixels && getElevationGrid(pixels, { latitude, longitude }, sideKm, BLOCK_SEGMENTS),
    [pixels, latitude, longitude, sideKm],
  );
}
