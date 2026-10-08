import { flexRender } from '@tanstack/react-table';
import type { Header, ReactTable, RowData } from '@tanstack/react-table';

import { Skeleton } from '@/components/ui/skeleton';
import type { DataTableFeatures } from '@/lib/data-table/table';

const SKELETON_ROW_COUNT = 8;

function getAriaSort<TData extends RowData>(header: Header<DataTableFeatures, TData, unknown>) {
  const sorted = header.column.getIsSorted();
  if (sorted === 'asc') return 'ascending';
  if (sorted === 'desc') return 'descending';
  return header.column.getCanSort() ? 'none' : undefined;
}

export function DataTable<TData extends RowData>({
  table,
  isLoading,
  caption,
}: {
  table: ReactTable<DataTableFeatures, TData>;
  isLoading: boolean;
  caption: string;
}) {
  const columnCount = table.getAllLeafColumns().length;

  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead className="text-left text-xs text-muted">
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id} className="border-b border-line">
            {headerGroup.headers.map((header) => (
              <th
                key={header.id}
                scope="col"
                aria-sort={getAriaSort(header)}
                className="px-3 py-2 font-medium whitespace-nowrap"
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {isLoading
          ? Array.from({ length: SKELETON_ROW_COUNT }, (_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-surface">
                {Array.from({ length: columnCount }, (_, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-2.5">
                    <Skeleton />
                  </td>
                ))}
              </tr>
            ))
          : table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-surface hover:bg-surface">
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
      </tbody>
    </table>
  );
}
