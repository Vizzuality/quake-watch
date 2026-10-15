import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { getMagnitudeColor } from '@/lib/earthquakes/magnitude';
import { SOURCE_ADAPTERS } from '@/lib/earthquakes/query-options';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getCoordinatesLabel, getFullDateTimeLabel, getKmLabel } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

function HeaderFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs tracking-wide text-muted uppercase">{label}</dt>
      <dd className="text-sm text-paper">{children}</dd>
    </div>
  );
}

export function DetailHeader({ earthquake }: { earthquake: Earthquake }) {
  const locale = getLocale();
  const sourceLabel = SOURCE_ADAPTERS[earthquake.source].label;

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
      <div className="flex shrink-0 items-baseline gap-2 sm:flex-col sm:items-start sm:gap-0">
        <p
          className="text-6xl leading-none font-semibold tabular-nums"
          style={{ color: getMagnitudeColor(earthquake.magnitude) }}
        >
          {earthquake.magnitude.toFixed(1)}
        </p>
        <p className="text-sm text-muted">
          {earthquake.magnitudeType
            ? m.detail_magnitude_with_type({ type: earthquake.magnitudeType })
            : m.col_magnitude()}
        </p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {earthquake.place ?? m.place_unknown()}
          </h1>
          <div className="flex items-center gap-2">
            <span className="rounded border border-line bg-surface px-2 py-0.5 text-xs font-medium text-muted">
              {sourceLabel}
            </span>
            <a href={earthquake.url} target="_blank" rel="noreferrer" className={buttonVariants()}>
              {m.detail_view_on_source({ source: sourceLabel })}
              <ExternalLink aria-hidden className="size-4" />
            </a>
          </div>
        </div>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <HeaderFact label={m.detail_label_time_local()}>
            <time dateTime={new Date(earthquake.time).toISOString()}>
              {getFullDateTimeLabel(earthquake.time, locale)}
            </time>
          </HeaderFact>
          <HeaderFact label={m.detail_label_time_utc()}>
            {getFullDateTimeLabel(earthquake.time, locale, 'UTC')}
          </HeaderFact>
          <HeaderFact label={m.detail_label_depth()}>
            {getKmLabel(earthquake.depthKm, locale, 1)}
          </HeaderFact>
          <HeaderFact label={m.detail_label_epicenter()}>
            {getCoordinatesLabel(earthquake, locale)}
          </HeaderFact>
        </dl>
      </div>
    </header>
  );
}
