import { createFileRoute } from '@tanstack/react-router';

import { Wordmark } from '@/components/brand/wordmark';
import { EARTHQUAKE_SEARCH_ROUTE } from '@/lib/earthquakes/search-schema';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/')({
  ...EARTHQUAKE_SEARCH_ROUTE,
  component: Home,
});

function Home() {
  const { source, interval, minmag, depth } = Route.useSearch();

  return (
    <main
      className="grid min-h-dvh place-items-center bg-background text-foreground"
      data-source={source}
      data-interval={interval}
      data-minmag={minmag}
      data-depth={depth}
    >
      <h1 className="sr-only">{m.app_title()}</h1>
      <Wordmark />
    </main>
  );
}
