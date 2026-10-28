import { Link } from '@tanstack/react-router';

import { buttonVariants } from '@/components/ui/button';
import type { EarthquakeSource } from '@/lib/earthquakes/search-schema';
import { m } from '@/paraglide/messages';

import { LargestEarthquakes } from './largest-earthquakes';
import { RecordingDrum } from './recording-drum';

export function QuakeNotFound({
  source,
  title,
  body,
  hasHomeLink = true,
}: {
  source: EarthquakeSource;
  title: string;
  body?: string;
  hasHomeLink?: boolean;
}) {
  return (
    <div className="flex flex-col gap-10 py-8">
      <div className="flex flex-col gap-6">
        <div className="flex max-w-prose flex-col items-start gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
          <p className="text-muted">{m.not_found_nothing_recorded()}</p>
          {body && <p className="text-muted">{body}</p>}
          {hasHomeLink && (
            <Link to="/" className={buttonVariants()}>
              {m.not_found_see_all()}
            </Link>
          )}
        </div>
        <RecordingDrum />
      </div>
      <LargestEarthquakes source={source} />
    </div>
  );
}
