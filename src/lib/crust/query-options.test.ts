import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCrustCells = vi.hoisted(() => vi.fn<(args: { data: unknown }) => Promise<unknown>>());
vi.mock('@/server/crust', () => ({ getCrustCells }));

import { crustCellsQueryOptions } from './query-options';

const input = { latitude: 40.4, longitude: -3.7, radiusCells: 2 };

describe('crustCellsQueryOptions', () => {
  beforeEach(() => {
    getCrustCells.mockReset();
  });

  it('keys the query by epicentre and radius', () => {
    expect(crustCellsQueryOptions(input).queryKey).toEqual(['crust-cells', 40.4, -3.7, 2]);
  });

  it('never goes stale since the model is static', () => {
    expect(crustCellsQueryOptions(input).staleTime).toBe(Infinity);
  });

  it('fetches through the server function with the input as data', async () => {
    const cells = [{ latitude: 40.5, longitude: -3.5, boundaryElevationsKm: [0] }];
    getCrustCells.mockResolvedValue(cells);
    const { queryFn } = crustCellsQueryOptions(input);
    const result = await (queryFn as () => Promise<unknown>)();
    expect(getCrustCells).toHaveBeenCalledWith({ data: input });
    expect(result).toBe(cells);
  });
});
