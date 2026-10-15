import { Link } from '@tanstack/react-router';
import type { ReactTable } from '@tanstack/react-table';

import { MagnitudeBadge } from '@/components/magnitude-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EarthquakeMeaning } from '@/containers/search/earthquake-meaning';
import type { DataTableFeatures } from '@/lib/data-table/table';
import { getEarthquakeDetailLinkOptions } from '@/lib/earthquakes/detail-link';
import type { EarthquakeRow } from '@/lib/earthquakes/rows';
import { getKmLabel, getTimeLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

const SKELETON_CARD_COUNT = 8;

function getCardMeta(earthquake: EarthquakeRow, now: number, locale: Locale): string {
  return [
    getTimeLabel(earthquake.time, now, locale),
    m.card_depth({ depth: getKmLabel(earthquake.depthKm, locale, 1) }),
    earthquake.distanceKm === null
      ? null
      : m.card_distance({ distance: getKmLabel(earthquake.distanceKm, locale) }),
  ]
    .filter(Boolean)
    .join(' · ');
}

export function EarthquakeCards({
  table,
  isLoading,
  locale,
  now,
  place,
  arrivedIds,
  arrivedClassName,
}: {
  table: ReactTable<DataTableFeatures, EarthquakeRow>;
  isLoading: boolean;
  locale: Locale;
  now: number;
  place: string | undefined;
  arrivedIds: ReadonlySet<string>;
  arrivedClassName: string;
}) {
  if (isLoading) {
    return (
      <ul aria-label={m.table_caption()} aria-busy className="flex flex-col">
        {Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
          <li
            key={index}
            aria-hidden
            data-testid="card-skeleton"
            className="flex gap-3 border-b border-line py-3"
          >
            <Skeleton className="h-8 w-12" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul aria-label={m.table_caption()} className="flex flex-col">
      {table.getRowModel().rows.map(({ original: earthquake }) => (
        <li
          key={earthquake.id}
          className={cn(
            'relative -mx-2 flex items-start gap-3 rounded-xs border-b border-line px-2 py-3 transition-colors duration-150 focus-within:bg-surface active:bg-surface',
            arrivedIds.has(earthquake.id) && arrivedClassName,
          )}
        >
          <MagnitudeBadge magnitude={earthquake.magnitude} className="py-1 text-base" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Link
              {...getEarthquakeDetailLinkOptions(earthquake)}
              className="font-medium text-pretty text-fg after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
            >
              {arrivedIds.has(earthquake.id) ? (
                <span className="sr-only">{m.arrival_new()}: </span>
              ) : null}
              {earthquake.place ?? m.place_unknown()}
            </Link>
            <EarthquakeMeaning
              earthquake={earthquake}
              place={place}
              locale={locale}
              className="text-sm"
            />
            <span className="text-xs text-muted tabular-nums">
              {getCardMeta(earthquake, now, locale)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
