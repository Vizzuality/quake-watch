import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { QuakeMap } from '@/components/map/quake-map';
import { MagnitudeLegend } from '@/containers/map/legend';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';

export const Route = createFileRoute('/')({
  ssr: false,
  component: Home,
});

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

function getCountLabel(count: number): string {
  return count === 1 ? '1 earthquake' : `${count} earthquakes`;
}

function Home() {
  const { data, isPending, isError, dataUpdatedAt } = useQuery(earthquakesQueryOptions);

  const earthquakes = data ?? [];
  const summary = `M2.5+ · last 24 h · ${getCountLabel(earthquakes.length)} · updated ${timeFormat.format(dataUpdatedAt)}`;

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <QuakeMap earthquakes={earthquakes} />
      <header className="absolute top-3 left-3 max-w-[calc(100%-1.5rem)] rounded-lg bg-ink/70 px-3 py-2 backdrop-blur">
        <h1 className="text-base font-semibold tracking-tight">Quake Watch</h1>
        {data ? (
          <p aria-live="polite" className="text-xs text-muted">
            {summary}
          </p>
        ) : null}
        {isPending ? <p className="text-xs text-muted">Loading earthquakes…</p> : null}
        {isError ? (
          <p role="alert" className="text-xs text-red-400">
            Couldn't reach USGS. Retrying every minute.
          </p>
        ) : null}
      </header>
      <MagnitudeLegend />
    </main>
  );
}
