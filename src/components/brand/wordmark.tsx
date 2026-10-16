import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

const TRACE_POINTS = '0,10 4,10 5.5,6 7,15 8.5,2 10,17 11.5,7 13,12 14.5,9 16,10 20,10';

export function Wordmark({ as: Tag = 'h1', className }: { as?: 'h1' | 'p'; className?: string }) {
  return (
    <Tag
      className={cn(
        'inline-flex items-center gap-2 text-base font-semibold tracking-tight whitespace-nowrap',
        className,
      )}
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 shrink-0 text-mag-4">
        <polyline
          points={TRACE_POINTS}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {m.app_title()}
    </Tag>
  );
}
