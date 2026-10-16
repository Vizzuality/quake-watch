import { Skeleton } from '@/components/ui/skeleton';
import { m } from '@/paraglide/messages';

export function DetailSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <p className="sr-only">{m.detail_loading()}</p>
      <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:gap-6">
        <Skeleton className="h-14 w-24 rounded-sm" />
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-8 w-full max-w-md" />
          <Skeleton className="h-5 w-64 max-w-full" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-md sm:h-80" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    </div>
  );
}
