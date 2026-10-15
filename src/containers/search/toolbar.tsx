import { SlidersHorizontalIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Filters } from '@/containers/search/filters';
import { useEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { getActiveFilterCount } from '@/lib/earthquakes/filters';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

export function FiltersSheet({
  idPrefix,
  triggerClassName,
  labelClassName,
  children,
}: {
  idPrefix: string;
  triggerClassName?: string;
  labelClassName?: string;
  children?: ReactNode;
}) {
  const search = useEarthquakeSearch();
  const activeFilterCount = getActiveFilterCount(search);

  return (
    <Sheet>
      <SheetTrigger className={buttonVariants({ className: cn('h-10 px-4', triggerClassName) })}>
        <SlidersHorizontalIcon aria-hidden="true" className="size-4" />
        <span className={labelClassName}>{m.filters_button()}</span>
        {activeFilterCount > 0 ? (
          <span className="rounded-xs bg-fg px-1.5 font-mono text-xs text-canvas tabular-nums">
            {activeFilterCount}
          </span>
        ) : null}
      </SheetTrigger>
      <SheetContent title={m.filters_title()}>
        <Filters idPrefix={idPrefix} />
        {children}
      </SheetContent>
    </Sheet>
  );
}

export function SearchToolbar() {
  return (
    <>
      <div className="hidden rounded-md border border-line bg-surface px-4 py-3 lg:block">
        <Filters idPrefix="toolbar" />
      </div>
      <div className="lg:hidden">
        <FiltersSheet idPrefix="sheet" />
      </div>
    </>
  );
}
