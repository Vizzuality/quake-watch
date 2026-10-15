import { flexRender } from '@tanstack/react-table';
import type { Header, ReactTable, Row, RowData } from '@tanstack/react-table';

import { Skeleton } from '@/components/ui/skeleton';
import type { DataTableFeatures } from '@/lib/data-table/table';
import { cn } from '@/lib/utils';

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
  columnClassNames = {},
  getRowClassName,
}: {
  table: ReactTable<DataTableFeatures, TData>;
  isLoading: boolean;
  caption: string;
  columnClassNames?: Record<string, string>;
  getRowClassName?: (row: Row<DataTableFeatures, TData>) => string | undefined;
}) {
  const columns = table.getAllLeafColumns();

  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead className="sticky top-0 z-10 bg-canvas text-left text-xs text-muted">
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id} className="border-b border-line-strong">
            {headerGroup.headers.map((header) => (
              <th
                key={header.id}
                scope="col"
                aria-sort={getAriaSort(header)}
                className={cn(
                  'px-3 py-2.5 font-medium whitespace-nowrap',
                  columnClassNames[header.column.id],
                )}
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
              <tr key={rowIndex} className="h-13 border-b border-line">
                {columns.map((column) => (
                  <td key={column.id} className={cn('px-3', columnClassNames[column.id])}>
                    <Skeleton className={column.id === 'magnitude' ? 'h-6 w-11' : 'w-3/4'} />
                  </td>
                ))}
              </tr>
            ))
          : table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  'relative h-13 border-b border-line transition-colors duration-150 focus-within:bg-surface hover:bg-surface',
                  getRowClassName?.(row),
                )}
              >
                {row.getAllCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cn('px-3 py-2 whitespace-nowrap', columnClassNames[cell.column.id])}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
      </tbody>
    </table>
  );
}
