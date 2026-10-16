import { ChevronDown, Info } from 'lucide-react';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

export function SectionExplainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={cn('group text-sm', className)}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-muted marker:hidden hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg [&::-webkit-details-marker]:hidden">
        {m.detail_what_does_this_mean()}
        <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2 flex max-w-prose flex-col gap-2 leading-relaxed text-muted">
        {children}
      </div>
    </details>
  );
}

export function DatumList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('flex flex-col divide-y divide-line', className)}>{children}</dl>;
}

export function Datum({
  label,
  value,
  explanation,
  className,
}: {
  label: string;
  value: ReactNode;
  explanation?: ReactNode;
  className?: string;
}) {
  const explanationId = useId();
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('flex flex-col gap-1 py-2.5 sm:flex-row sm:gap-4', className)}>
      <dt className="text-sm text-muted sm:w-48 sm:shrink-0">{label}</dt>
      <dd className="flex flex-1 flex-wrap items-center gap-x-2 text-sm text-fg tabular-nums">
        <span>{value}</span>
        {explanation ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={explanationId}
            aria-label={m.detail_explain_datum({ label })}
            onClick={() => setOpen((current) => !current)}
            className="inline-flex size-8 items-center justify-center rounded-xs text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
          >
            <Info aria-hidden className="size-4" />
          </button>
        ) : null}
        {explanation ? (
          <p
            id={explanationId}
            hidden={!open}
            className="max-w-prose basis-full text-sm leading-relaxed text-muted"
          >
            {explanation}
          </p>
        ) : null}
      </dd>
    </div>
  );
}
