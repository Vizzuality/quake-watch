import { SlidersHorizontalIcon } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Filters } from '@/containers/search/filters';
import { useEarthquakeSearch } from '@/hooks/use-earthquake-search';
import { getActiveFilterCount } from '@/lib/earthquakes/filters';
import { m } from '@/paraglide/messages';

export function SearchToolbar() {
  const search = useEarthquakeSearch();
  const activeFilterCount = getActiveFilterCount(search);

  return (
    <>
      <div className="hidden rounded-md border border-line bg-surface px-4 py-3 md:block">
        <Filters idPrefix="toolbar" />
      </div>
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger className={buttonVariants({ className: 'h-10 px-4' })}>
            <SlidersHorizontalIcon aria-hidden="true" className="size-4" />
            {m.filters_button()}
            {activeFilterCount > 0 ? (
              <span className="rounded-xs bg-fg px-1.5 font-mono text-xs text-canvas tabular-nums">
                {activeFilterCount}
              </span>
            ) : null}
          </SheetTrigger>
          <SheetContent title={m.filters_title()}>
            <Filters idPrefix="sheet" />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
