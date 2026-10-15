import { SearchSummary } from '@/containers/search/summary';
import { SearchTable } from '@/containers/search/table';
import { SearchToolbar } from '@/containers/search/toolbar';
import { LanguageSwitch } from '@/containers/shell/language-switch';
import { ThemeSwitch } from '@/containers/shell/theme-switch';
import { ViewTabs } from '@/containers/shell/view-tabs';
import { m } from '@/paraglide/messages';

export function SearchLayout() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-4 px-4 py-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">{m.app_title()}</h1>
        <div className="flex items-center gap-4">
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
