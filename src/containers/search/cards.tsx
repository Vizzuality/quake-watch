import type { ReactTable } from '@tanstack/react-table';

import { MagnitudeBadge } from '@/components/magnitude-badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { DataTableFeatures } from '@/lib/data-table/table';
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
            <a
              href={earthquake.url}
              target="_blank"
              rel="noreferrer"
              className="truncate font-medium hover:underline"
            >
              {earthquake.place ?? m.place_unknown()}
            </a>
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
