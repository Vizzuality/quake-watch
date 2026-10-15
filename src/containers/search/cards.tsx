import { Link } from '@tanstack/react-router';
import type { ReactTable } from '@tanstack/react-table';
import { ArrowUpRightIcon } from 'lucide-react';

import { MagnitudeBadge } from '@/components/magnitude-badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { DataTableFeatures } from '@/lib/data-table/table';
import { getEarthquakeDetailLinkOptions } from '@/lib/earthquakes/detail-link';
import type { EarthquakeRow } from '@/lib/earthquakes/rows';
import { getKmLabel, getTimeLabel } from '@/lib/format';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

const SKELETON_CARD_COUNT = 8;

export function EarthquakeCards({
  table,
  isLoading,
  locale,
  now,
}: {
  table: ReactTable<DataTableFeatures, EarthquakeRow>;
  isLoading: boolean;
  locale: Locale;
  now: number;
}) {
  if (isLoading) {
    return (
      <ul aria-label={m.table_caption()} aria-busy className="flex flex-col gap-2">
        {Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
          <li
            key={index}
            aria-hidden
            data-testid="card-skeleton"
            className="rounded-lg border border-line bg-surface p-3"
          >
            <Skeleton />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul aria-label={m.table_caption()} className="flex flex-col gap-2">
      {table.getRowModel().rows.map(({ original: earthquake }) => (
        <li
          key={earthquake.id}
          className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3 text-sm"
        >
          <MagnitudeBadge magnitude={earthquake.magnitude} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Link
              {...getEarthquakeDetailLinkOptions(earthquake)}
              className="group flex min-w-0 items-center gap-1 rounded font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
            >
              <span className="truncate">{earthquake.place ?? m.place_unknown()}</span>
              <ArrowUpRightIcon
                aria-hidden="true"
                className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg"
              />
            </Link>
            <span className="text-xs text-muted">
              {[
                getTimeLabel(earthquake.time, now, locale),
                getKmLabel(earthquake.depthKm, locale, 1),
                earthquake.distanceKm === null ? null : getKmLabel(earthquake.distanceKm, locale),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
