import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { LanguageSwitch } from '@/containers/shell/language-switch';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

export function DetailLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/" className={cn(buttonVariants({ variant: 'ghost' }), '-ml-3')}>
          <ArrowLeft aria-hidden className="size-4" />
          {m.detail_back_to_list()}
        </Link>
        <LanguageSwitch />
      </div>
      {children}
    </main>
  );
}
