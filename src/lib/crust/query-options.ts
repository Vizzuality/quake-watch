import { queryOptions } from '@tanstack/react-query';

import { getCrustCells } from '@/server/crust';

import type { CrustCellsInput } from './types';

export function crustCellsQueryOptions({ latitude, longitude, radiusCells }: CrustCellsInput) {
  return queryOptions({
    queryKey: ['crust-cells', latitude, longitude, radiusCells] as const,
    queryFn: () => getCrustCells({ data: { latitude, longitude, radiusCells } }),
    staleTime: Infinity,
  });
}
