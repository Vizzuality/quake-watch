import type { PaginationState, SortingState } from '@tanstack/react-table';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';

import { createAppColumnHelper, useAppTable } from '@/lib/data-table/table';

import { ColumnHeader } from './column-header';
import { DataTable } from './data-table';
import { Pagination } from './pagination';

type TestRow = { id: string; value: number };
const ROWS: TestRow[] = Array.from({ length: 12 }, (_, index) => ({
  id: `r${index}`,
  value: index,
}));
const columnHelper = createAppColumnHelper<TestRow>();
const COLUMNS = columnHelper.columns([
  columnHelper.accessor('value', {
    id: 'value',
    sortDescFirst: true,
    header: ({ column }) => <ColumnHeader column={column} title="Value" />,
    cell: ({ getValue }) => String(getValue()),
  }),
]);

function TestTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 5 });
  const table = useAppTable({
    data: ROWS,
    columns: COLUMNS,
    getRowId: (row) => row.id,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  });
  return (
    <>
      <DataTable table={table} isLoading={false} caption="Test" />
      <Pagination table={table} />
    </>
  );
}

describe('DataTable', () => {
  it('sorts by a column and exposes aria-sort', async () => {
    const screen = await render(<TestTable />);
    await screen.getByRole('button', { name: 'Value' }).click();
    await expect
      .element(screen.getByRole('columnheader', { name: 'Value' }))
      .toHaveAttribute('aria-sort', 'descending');
    await expect.element(screen.getByRole('row').nth(1)).toHaveTextContent('11');
  });

  it('paginates', async () => {
    const screen = await render(<TestTable />);
    await expect.element(screen.getByText('Page 1 of 3')).toBeVisible();
    await screen.getByRole('button', { name: 'Next' }).click();
    await expect.element(screen.getByText('Page 2 of 3')).toBeVisible();
    await expect.element(screen.getByRole('row').nth(1)).toHaveTextContent('5');
  });
});
