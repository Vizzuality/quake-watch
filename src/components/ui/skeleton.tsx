import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('block h-4 animate-pulse rounded bg-line', className)} />
  );
}
