import { Link } from '@tanstack/react-router';

import { buttonVariants } from '@/components/ui/button';
import { PageShell } from '@/containers/shell/page-shell';
import { m } from '@/paraglide/messages';

export function NotFoundComponent() {
  return (
    <PageShell>
      <section className="flex max-w-prose flex-col items-start gap-4 py-8">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          {m.not_found_title()}
        </h1>
        <p className="text-muted">{m.not_found_body()}</p>
        <Link to="/" className={buttonVariants()}>
          {m.error_back_home()}
        </Link>
      </section>
    </PageShell>
  );
}
