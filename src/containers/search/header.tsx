import { Wordmark } from '@/components/brand/wordmark';
import { LanguageSwitch } from '@/containers/shell/language-switch';
import { ThemeSwitch } from '@/containers/shell/theme-switch';
import { ViewTabs } from '@/containers/shell/view-tabs';

export function SearchHeader() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line pb-4">
      <Wordmark />
      <div className="flex items-center gap-3">
        <ViewTabs current="table" />
        <LanguageSwitch />
        <ThemeSwitch />
      </div>
    </header>
  );
}
