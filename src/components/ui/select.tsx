import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-10 rounded-md border border-line-strong sm:h-8 bg-surface px-2 text-sm text-fg disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
