import { Wordmark } from '@/components/brand/wordmark';
import { SearchSummary } from '@/containers/search/summary';
import { SearchTable } from '@/containers/search/table';
import { SearchToolbar } from '@/containers/search/toolbar';
import { LanguageSwitch } from '@/containers/shell/language-switch';
import { ThemeSwitch } from '@/containers/shell/theme-switch';
import { ViewTabs } from '@/containers/shell/view-tabs';

export function SearchLayout() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-4 pt-4 pb-12 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line pb-4">
        <Wordmark />
        <div className="flex items-center gap-3">
          <ViewTabs current="table" />
          <LanguageSwitch />
          <ThemeSwitch />
        </div>
      </header>
      <SearchToolbar />
      <SearchSummary />
      <SearchTable />
    </main>
  );
}
