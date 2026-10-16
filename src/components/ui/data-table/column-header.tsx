import type { Column, RowData } from '@tanstack/react-table';
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react';

import type { DataTableFeatures } from '@/lib/data-table/table';

function getSortIcon(sorted: false | 'asc' | 'desc') {
  if (sorted === 'asc') return <ArrowUpIcon aria-hidden="true" className="size-3.5" />;
  if (sorted === 'desc') return <ArrowDownIcon aria-hidden="true" className="size-3.5" />;
  return <ArrowUpDownIcon aria-hidden="true" className="size-3.5 opacity-50" />;
}

export function ColumnHeader<TData extends RowData, TValue>({
  column,
  title,
}: {
  column: Column<DataTableFeatures, TData, TValue>;
  title: string;
}) {
  if (!column.getCanSort()) return <span>{title}</span>;
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className="inline-flex items-center gap-1 font-medium hover:text-fg"
    >
      {title}
      {getSortIcon(column.getIsSorted())}
    </button>
  );
}
