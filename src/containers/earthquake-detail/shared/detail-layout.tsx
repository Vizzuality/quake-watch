import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { PageShell } from '@/containers/shell/page-shell';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

export function DetailLayout({ children }: { children: ReactNode }) {
  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <Link
          to="/"
          className={cn(buttonVariants({ variant: 'ghost' }), 'self-start px-0 sm:px-0')}
        >
          <ArrowLeft aria-hidden className="size-4" />
          {m.detail_back_to_list()}
        </Link>
        {children}
      </div>
    </PageShell>
  );
}
