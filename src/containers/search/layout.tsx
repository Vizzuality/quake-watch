import { SearchHeader } from '@/containers/search/header';
import { SearchSummary } from '@/containers/search/summary';
import { SearchTable } from '@/containers/search/table';
import { SearchToolbar } from '@/containers/search/toolbar';

export function SearchLayout() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-4 pt-4 pb-12 sm:px-6">
      <SearchHeader />
      <SearchToolbar />
      <SearchSummary />
      <SearchTable />
    </main>
  );
}
