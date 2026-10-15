import { Link } from '@tanstack/react-router';

import { MagnitudeBadge } from '@/components/magnitude-badge';
import { ColumnHeader } from '@/components/ui/data-table/column-header';
import { EarthquakeMeaning } from '@/containers/search/earthquake-meaning';
import { createAppColumnHelper } from '@/lib/data-table/table';
import { getEarthquakeDetailLinkOptions } from '@/lib/earthquakes/detail-link';
import type { EarthquakeRow } from '@/lib/earthquakes/rows';
import { getKmLabel, getTimeLabel } from '@/lib/format';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

export const EARTHQUAKE_COLUMN_CLASS_NAMES: Record<string, string> = {
  magnitude: 'w-20',
  place: 'w-full min-w-44 whitespace-normal',
  meaning: 'min-w-40 whitespace-normal xl:whitespace-nowrap',
  distance: 'text-right',
  depth: 'text-right',
};

export function getEarthquakeColumns({
  hasDistance,
  locale,
  now,
  place,
  arrivedIds,
}: {
  hasDistance: boolean;
  locale: Locale;
  now: number;
  place: string | undefined;
  arrivedIds: ReadonlySet<string>;
}) {
  const columnHelper = createAppColumnHelper<EarthquakeRow>();
  const columns = columnHelper.columns([
    columnHelper.accessor('magnitude', {
      id: 'magnitude',
      sortDescFirst: true,
      header: ({ column }) => <ColumnHeader column={column} title={m.col_magnitude()} />,
      cell: ({ getValue }) => <MagnitudeBadge magnitude={getValue()} className="py-0.5" />,
    }),
    columnHelper.accessor((row) => row.place ?? '', {
      id: 'place',
      header: ({ column }) => <ColumnHeader column={column} title={m.col_place()} />,
      cell: ({ row }) => (
        <Link
          {...getEarthquakeDetailLinkOptions(row.original)}
          className="font-medium text-fg after:absolute after:inset-0 hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
        >
          {arrivedIds.has(row.id) ? <span className="sr-only">{m.arrival_new()}: </span> : null}
          {row.original.place ?? m.place_unknown()}
        </Link>
      ),
    }),
    columnHelper.display({
      id: 'meaning',
      header: () => <span>{m.col_meaning()}</span>,
      cell: ({ row }) => (
        <EarthquakeMeaning earthquake={row.original} place={place} locale={locale} />
      ),
    }),
    columnHelper.accessor('time', {
      id: 'time',
      sortDescFirst: true,
      header: ({ column }) => <ColumnHeader column={column} title={m.col_time()} />,
      cell: ({ getValue }) => (
        <time dateTime={new Date(getValue()).toISOString()} className="text-muted">
          {getTimeLabel(getValue(), now, locale)}
        </time>
      ),
    }),
    columnHelper.accessor((row) => row.distanceKm ?? 0, {
      id: 'distance',
      header: ({ column }) => <ColumnHeader column={column} title={m.col_distance()} />,
      cell: ({ getValue }) => (
        <span className="tabular-nums">{getKmLabel(getValue(), locale)}</span>
      ),
    }),
    columnHelper.accessor('depthKm', {
      id: 'depth',
      header: ({ column }) => <ColumnHeader column={column} title={m.col_depth()} />,
      cell: ({ getValue }) => (
        <span className="tabular-nums">{getKmLabel(getValue(), locale, 1)}</span>
      ),
    }),
    columnHelper.accessor((row) => row.magnitudeType ?? '', {
      id: 'magnitudeType',
      header: ({ column }) => <ColumnHeader column={column} title={m.col_magnitude_type()} />,
      cell: ({ getValue }) => <span className="font-mono text-xs text-muted">{getValue()}</span>,
    }),
  ]);
  return columns.filter((column) => hasDistance || column.id !== 'distance');
}
