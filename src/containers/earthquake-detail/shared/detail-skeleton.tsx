import { Skeleton } from '@/components/ui/skeleton';
import { m } from '@/paraglide/messages';

export function DetailSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <p className="sr-only">{m.detail_loading()}</p>
      <Skeleton className="h-16 w-full max-w-xl" />
      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}
