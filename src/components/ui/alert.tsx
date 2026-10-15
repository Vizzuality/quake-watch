import type { ReactNode } from 'react';

export function Alert({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-alert/40 bg-alert/10 px-3 py-2 text-sm text-alert"
    >
      <p>{children}</p>
      {action}
    </div>
  );
}
