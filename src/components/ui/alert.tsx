import { TriangleAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function Alert({
  children,
  hint,
  action,
}: {
  children: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-md border border-alert/50 bg-alert/10 px-4 py-3 text-sm"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-alert" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-medium text-fg">{children}</p>
          {hint ? <p className="text-muted">{hint}</p> : null}
        </div>
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}
