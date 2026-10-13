import { EARTHQUAKE_LIMIT } from '@/lib/earthquakes/query-options';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

export function TruncatedNotice({ className }: { className?: string }) {
  const limit = new Intl.NumberFormat(getLocale()).format(EARTHQUAKE_LIMIT);
  return (
    <output
      className={cn('block rounded-lg border border-line px-3 py-2 text-xs text-muted', className)}
    >
      {m.truncated_notice({ limit })}
    </output>
  );
}
