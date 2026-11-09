import { Link } from '@tanstack/react-router';

import { m } from '@/paraglide/messages';

export function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center text-foreground">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-body text-muted">{m.not_found_line()}</h1>
        <Link to="/" className="text-button text-foreground uppercase underline underline-offset-4">
          {m.back_to_globe()}
        </Link>
      </div>
    </main>
  );
}
