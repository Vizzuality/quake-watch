import { Link } from '@tanstack/react-router';
import { ArrowUpRightIcon } from 'lucide-react';

import { MagnitudeBadge } from '@/components/magnitude-badge';
import { ColumnHeader } from '@/components/ui/data-table/column-header';
import { createAppColumnHelper } from '@/lib/data-table/table';
import { getEarthquakeDetailLinkOptions } from '@/lib/earthquakes/detail-link';
import type { EarthquakeRow } from '@/lib/earthquakes/rows';
import { getKmLabel, getTimeLabel } from '@/lib/format';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

export function getEarthquakeColumns({
  hasDistance,
  locale,
  now,
}: {
  hasDistance: boolean;
  locale: Locale;
  now: number;
}) {
  const columnHelper = createAppColumnHelper<EarthquakeRow>();
  const columns = columnHelper.columns([
    columnHelper.accessor('magnitude', {
      id: 'magnitude',
      sortDescFirst: true,
      header: ({ column }) => <ColumnHeader column={column} title={m.col_magnitude()} />,
      cell: ({ getValue }) => <MagnitudeBadge magnitude={getValue()} />,
    }),
    columnHelper.accessor('time', {
      id: 'time',
      sortDescFirst: true,
      header: ({ column }) => <ColumnHeader column={column} title={m.col_time()} />,
      cell: ({ getValue }) => (
        <time dateTime={new Date(getValue()).toISOString()}>
          {getTimeLabel(getValue(), now, locale)}
        </time>
      ),
    }),
    columnHelper.accessor((row) => row.place ?? '', {
      id: 'place',
      header: ({ column }) => <ColumnHeader column={column} title={m.col_place()} />,
      cell: ({ row }) => (
        <Link
          {...getEarthquakeDetailLinkOptions(row.original)}
          className="group inline-flex items-center gap-1 rounded font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
        >
          {row.original.place ?? m.place_unknown()}
          <ArrowUpRightIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-paper"
          />
        </Link>
      ),
    }),
    columnHelper.accessor((row) => row.distanceKm ?? 0, {
      id: 'distance',
      header: ({ column }) => <ColumnHeader column={column} title={m.col_distance()} />,
      cell: ({ getValue }) => getKmLabel(getValue(), locale),
    }),
    columnHelper.accessor('depthKm', {
      id: 'depth',
      header: ({ column }) => <ColumnHeader column={column} title={m.col_depth()} />,
      cell: ({ getValue }) => getKmLabel(getValue(), locale, 1),
    }),
    columnHelper.accessor((row) => row.magnitudeType ?? '', {
      id: 'magnitudeType',
      header: ({ column }) => <ColumnHeader column={column} title={m.col_magnitude_type()} />,
      cell: ({ getValue }) => <span className="text-muted">{getValue()}</span>,
    }),
  ]);
  return columns.filter((column) => hasDistance || column.id !== 'distance');
}
