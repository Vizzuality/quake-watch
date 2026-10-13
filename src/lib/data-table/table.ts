import {
  createCoreRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  createTableHook,
  rowPaginationFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from '@tanstack/react-table';
import type { Updater } from '@tanstack/react-table';

const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  coreRowModel: createCoreRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns,
});

export type DataTableFeatures = typeof dataTableFeatures;

export const { useAppTable, createAppColumnHelper } = createTableHook({
  features: dataTableFeatures,
});

export function getUpdatedValue<T>(updater: Updater<T>, current: T): T {
  return typeof updater === 'function' ? (updater as (previous: T) => T)(current) : updater;
}
