import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useId } from 'react';

import { MagnitudeBadge } from '@/components/magnitude-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getEarthquakeDetailLinkOptions } from '@/lib/earthquakes/detail-link';
import { getLargestEarthquakes } from '@/lib/earthquakes/largest';
import { SOURCE_ADAPTERS, earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { EARTHQUAKE_SEARCH_DEFAULTS } from '@/lib/earthquakes/search-schema';
import type { EarthquakeSource } from '@/lib/earthquakes/search-schema';
import { getTimeLabel } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

const LIST_SIZE = 5;
const CARD_CLASS_NAME = 'w-full rounded-sm border border-line bg-surface';
const ROW_CLASS_NAME = 'flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0';
const SKELETON_ROWS = Array.from({ length: LIST_SIZE }, (_, index) => index);

export function LargestEarthquakes({ source }: { source: EarthquakeSource }) {
  const titleId = useId();
  const { data, dataUpdatedAt, isPending } = useQuery(
    earthquakesQueryOptions({ ...EARTHQUAKE_SEARCH_DEFAULTS, source }),
  );
  const earthquakes = getLargestEarthquakes(data?.earthquakes ?? [], LIST_SIZE);
  const locale = getLocale();

  if (isPending) {
    return (
      <div className={CARD_CLASS_NAME}>
        {SKELETON_ROWS.map((index) => (
          <div key={index} className={ROW_CLASS_NAME}>
            <Skeleton className="h-6 w-11" />
            <Skeleton className="w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (earthquakes.length === 0) return null;

  return (
    <section aria-labelledby={titleId} className={CARD_CLASS_NAME}>
      <h2 id={titleId} className="border-b border-line px-4 py-3 text-sm font-medium text-fg">
        {m.not_found_list_title({ agency: SOURCE_ADAPTERS[source].label })}
      </h2>
      <ul>
        {earthquakes.map((earthquake) => (
          <li key={earthquake.id} className="border-t border-line first:border-t-0">
            <Link
              {...getEarthquakeDetailLinkOptions(earthquake)}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-fg"
            >
              <MagnitudeBadge magnitude={earthquake.magnitude} />
              <span className="min-w-0 flex-1 truncate font-medium">
                {earthquake.place ?? m.place_unknown()}
              </span>
              <time
                dateTime={new Date(earthquake.time).toISOString()}
                className="shrink-0 text-xs text-muted tabular-nums sm:text-sm"
              >
                {getTimeLabel(earthquake.time, dataUpdatedAt, locale)}
              </time>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
