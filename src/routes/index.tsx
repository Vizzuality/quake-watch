import { createFileRoute } from '@tanstack/react-router';

import { Wordmark } from '@/components/brand/wordmark';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background text-foreground">
      <h1 className="sr-only">{m.app_title()}</h1>
      <Wordmark />
    </main>
  );
}
