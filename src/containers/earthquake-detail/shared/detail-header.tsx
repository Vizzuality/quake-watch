import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { MagnitudeBadge } from '@/components/magnitude-badge';
import { buttonVariants } from '@/components/ui/button';
import { EarthquakeMeaning } from '@/containers/search/earthquake-meaning';
import { MeaningFootnote } from '@/containers/search/states';
import { SOURCE_ADAPTERS } from '@/lib/earthquakes/query-options';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getCoordinatesLabel, getFullDateTimeLabel, getKmLabel, getTimeLabel } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

function HeaderFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm text-fg tabular-nums">{children}</dd>
    </div>
  );
}

export function DetailHeader({ earthquake }: { earthquake: Earthquake }) {
  const locale = getLocale();
  const sourceLabel = SOURCE_ADAPTERS[earthquake.source].label;
  const [now] = useState(Date.now);

  return (
    <header className="flex flex-col gap-6 border-b border-line pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-start sm:gap-1.5">
          <MagnitudeBadge
            magnitude={earthquake.magnitude}
            className="rounded-sm px-2.5 py-1.5 font-sans text-5xl leading-none tracking-tight"
          />
          <p className="text-sm text-muted">
            {earthquake.magnitudeType
              ? m.detail_magnitude_with_type({ type: earthquake.magnitudeType })
              : m.col_magnitude()}
          </p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {earthquake.place ?? m.place_unknown()}
          </h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
            <span>
              <EarthquakeMeaning
                earthquake={{ ...earthquake, distanceKm: null }}
                place={undefined}
                locale={locale}
                className="font-medium"
              />{' '}
              <span className="text-sm text-muted">{m.detail_meaning_model()}</span>
            </span>
            <span className="text-muted">{getTimeLabel(earthquake.time, now, locale)}</span>
          </p>
          <MeaningFootnote />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-xs border border-line px-2 py-0.5 font-mono text-xs text-muted">
            {sourceLabel}
          </span>
          <a href={earthquake.url} target="_blank" rel="noreferrer" className={buttonVariants()}>
            {m.detail_view_on_source({ source: sourceLabel })}
            <ExternalLink aria-hidden className="size-4" />
          </a>
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
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
    </header>
  );
}
