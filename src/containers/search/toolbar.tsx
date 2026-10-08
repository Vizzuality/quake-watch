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
      <div className="hidden md:block">
        <Filters idPrefix="toolbar" />
      </div>
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger className={buttonVariants()}>
            {m.filters_button()}
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-paper px-1.5 text-xs text-ink">
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
