import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { Wordmark } from '@/components/brand/wordmark';
import { LanguageSwitch } from '@/containers/shell/language-switch';
import { ThemeSwitch } from '@/containers/shell/theme-switch';
import { m } from '@/paraglide/messages';

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-4 pt-4 pb-16 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line pb-4">
        <Link
          to="/"
          aria-label={m.home_link_label()}
          className="rounded-xs focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fg"
        >
          <Wordmark as="p" />
        </Link>
        <div className="flex items-center gap-4">
          <LanguageSwitch />
          <ThemeSwitch />
        </div>
      </header>
      {children}
    </main>
  );
}
