import { useSuspenseQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { crustCellsQueryOptions } from '@/lib/crust/query-options';
import { getCrustalBlock, getCrustCellsInput } from '@/lib/crust/scene';

export type CrustalBlockProps = { latitude: number; longitude: number; depthKm: number };

export function getCrustalBlockQueryOptions({ latitude, longitude, depthKm }: CrustalBlockProps) {
  return crustCellsQueryOptions(getCrustCellsInput({ latitude, longitude }, depthKm));
}

export function useCrustalBlock({ latitude, longitude, depthKm }: CrustalBlockProps) {
  const { data: cells } = useSuspenseQuery(
    getCrustalBlockQueryOptions({ latitude, longitude, depthKm }),
  );
  return useMemo(
    () => ({ cells, ...getCrustalBlock(cells, { latitude, longitude }, depthKm) }),
    [cells, latitude, longitude, depthKm],
  );
}
