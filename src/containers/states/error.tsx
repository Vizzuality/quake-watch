import { Link } from '@tanstack/react-router';

import { m } from '@/paraglide/messages';

export function ErrorState() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-4 text-center">
        <div role="alert">
          <h1 className="text-body text-muted-2">{m.error_line()}</h1>
        </div>
        <Link to="/" className="text-control text-foreground underline underline-offset-4">
          {m.back_to_globe()}
        </Link>
      </div>
    </main>
  );
}
