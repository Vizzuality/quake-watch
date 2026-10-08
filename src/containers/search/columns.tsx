import { ExternalLinkIcon } from 'lucide-react';

import { MagnitudeBadge } from '@/components/magnitude-badge';
import { ColumnHeader } from '@/components/ui/data-table/column-header';
import { createAppColumnHelper } from '@/lib/data-table/table';
import type { EarthquakeRow } from '@/lib/earthquakes/rows';
import { getKmLabel, getTimeLabel } from '@/lib/format';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

export function getEarthquakeColumns({
  hasDistance,
  locale,
  now,
  sourceLabel,
}: {
  hasDistance: boolean;
  locale: Locale;
  now: number;
  sourceLabel: string;
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
      cell: ({ row }) => row.original.place ?? m.place_unknown(),
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
    columnHelper.display({
      id: 'link',
      header: () => <span className="sr-only">{m.col_details()}</span>,
      cell: ({ row }) => (
        <a
          href={row.original.url}
          target="_blank"
          rel="noreferrer"
          aria-label={m.open_event_details({ source: sourceLabel })}
          className="text-muted hover:text-paper"
        >
          <ExternalLinkIcon aria-hidden="true" className="size-4" />
        </a>
      ),
    }),
  ]);
  return columns.filter((column) => hasDistance || column.id !== 'distance');
}
