import { Link } from '@tanstack/react-router';

import { buttonVariants } from '@/components/ui/button';
import { m } from '@/paraglide/messages';

export function NotFoundComponent() {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-lg font-semibold">{m.not_found_title()}</h1>
        <Link to="/" className={buttonVariants()}>
          {m.error_back_home()}
        </Link>
      </div>
    </main>
  );
}
