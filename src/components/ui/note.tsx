import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

export function Note({ children }: { children: ReactNode }) {
  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-lg border border-line px-3 py-2 text-sm text-muted"
    >
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
