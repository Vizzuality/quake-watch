import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function Field({
  id,
  label,
  children,
  className,
}: {
  id: string;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
