import { Skeleton } from '@/components/ui/skeleton';
import { SearchHeader } from '@/containers/search/header';
import { cn } from '@/lib/utils';

const SKELETON_ROW_COUNT = 8;
const FILTER_FIELD_WIDTHS = ['w-64', 'w-22', 'w-31', 'w-21'];
const COLUMN_CLASS_NAMES = ['w-20', 'w-full min-w-44', 'min-w-40', '', 'text-right', ''];

function getCellSkeletonClassName(columnIndex: number): string {
  return columnIndex === 0 ? 'h-6 w-11' : 'w-3/4';
}

function ToolbarSkeleton() {
  return (
    <>
      <div className="hidden rounded-md border border-line bg-surface px-4 py-3 lg:block">
        <div className="flex flex-wrap items-end gap-3">
          {FILTER_FIELD_WIDTHS.map((width) => (
            <div key={width} className={cn('flex flex-col gap-1', width)}>
              <Skeleton className="w-16" />
              <Skeleton className="h-8 rounded-md" />
            </div>
          ))}
          <Skeleton className="h-8 w-25 rounded-md" />
          <Skeleton className="h-8 w-18" />
        </div>
      </div>
      <div className="lg:hidden">
        <Skeleton className="h-10 w-24 rounded-md" />
      </div>
    </>
  );
}

function TableSkeleton() {
  return (
    <table aria-hidden="true" className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-line-strong">
          {COLUMN_CLASS_NAMES.map((className, columnIndex) => (
            <th key={columnIndex} className={cn('px-3 py-2.5', className)}>
              <Skeleton className="h-[16.5px] w-12" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, rowIndex) => (
          <tr key={rowIndex} className="h-13 border-b border-line">
            {COLUMN_CLASS_NAMES.map((className, columnIndex) => (
              <td key={columnIndex} className={cn('px-3', className)}>
                <Skeleton className={getCellSkeletonClassName(columnIndex)} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CardsSkeleton() {
  return (
    <ul aria-hidden="true" className="flex flex-col">
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
        <li key={index} className="flex gap-3 border-b border-line py-3">
          <Skeleton className="h-8 w-12" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SearchShell() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-4 pt-4 pb-12 sm:px-6">
      <SearchHeader />
      <ToolbarSkeleton />
      <div className="flex flex-col gap-2 py-1">
        <Skeleton className="h-6 w-72 max-w-full" />
        <Skeleton className="h-3.5 w-56 max-w-full" />
      </div>
      <section aria-busy="true" className="flex flex-col gap-3">
        <div className="hidden lg:block">
          <TableSkeleton />
        </div>
        <div className="lg:hidden">
          <CardsSkeleton />
        </div>
      </section>
    </main>
  );
}
