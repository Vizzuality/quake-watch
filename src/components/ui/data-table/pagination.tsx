import type { ReactTable, RowData } from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import type { DataTableFeatures } from '@/lib/data-table/table';
import { m } from '@/paraglide/messages';

export function Pagination<TData extends RowData>({
  table,
}: {
  table: ReactTable<DataTableFeatures, TData>;
}) {
  const pageCount = table.getPageCount();
  if (pageCount <= 1) return null;
  const page = table.state.pagination.pageIndex + 1;

  return (
    <nav
      aria-label={m.pagination_label()}
      className="flex items-center justify-between gap-3 text-sm text-muted sm:justify-end"
    >
      <Button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
        {m.pagination_previous()}
      </Button>
      <span aria-live="polite" className="font-mono text-xs tabular-nums">
        {m.pagination_status({ page: String(page), pageCount: String(pageCount) })}
      </span>
      <Button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
        {m.pagination_next()}
      </Button>
    </nav>
  );
}
