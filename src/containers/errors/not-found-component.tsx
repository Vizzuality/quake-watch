import { QuakeNotFound } from '@/containers/not-found/quake-not-found';
import { PageShell } from '@/containers/shell/page-shell';
import { m } from '@/paraglide/messages';

export function NotFoundComponent() {
  return (
    <PageShell>
      <QuakeNotFound source="emsc" title={m.not_found_title()} />
    </PageShell>
  );
}
