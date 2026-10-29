import { Wordmark } from '@/components/brand/wordmark';
import { Skeleton } from '@/components/ui/skeleton';
import { LanguageSwitch } from '@/containers/shell/language-switch';
import { ThemeSwitch } from '@/containers/shell/theme-switch';
import { ViewTabs } from '@/containers/shell/view-tabs';

export function MapShell() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <header className="absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex flex-col gap-2.5 rounded-md border border-line bg-canvas/90 px-3 py-2.5 backdrop-blur sm:right-auto sm:w-md">
        <div className="flex items-center justify-between gap-3">
          <Wordmark />
          <div className="flex items-center gap-2">
            <ViewTabs current="map" />
            <Skeleton className="h-10 w-12.5 rounded-md sm:h-8 md:w-22" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="w-48" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
        <div className="hidden items-center gap-4 border-t border-line pt-2 sm:flex">
          <LanguageSwitch />
          <ThemeSwitch />
        </div>
      </header>
      <div
        aria-busy="true"
        className="absolute inset-x-3 bottom-[max(2.25rem,calc(env(safe-area-inset-bottom)+1.75rem))] z-10 flex flex-col gap-2 rounded-md border border-line bg-canvas/90 px-3 pt-2.5 pb-2 backdrop-blur sm:inset-x-auto sm:bottom-9 sm:left-1/2 sm:w-full sm:max-w-3xl sm:-translate-x-1/2"
      >
        <Skeleton className="h-6.5 w-61" />
        <Skeleton className="h-16" />
      </div>
    </main>
  );
}
