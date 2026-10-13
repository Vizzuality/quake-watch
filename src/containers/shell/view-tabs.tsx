import { Link } from '@tanstack/react-router';

import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

type View = 'table' | 'map';

function getTabClassName(isCurrent: boolean): string {
  return cn(
    'rounded px-2.5 py-1 text-xs font-medium',
    isCurrent ? 'bg-paper text-ink' : 'text-muted hover:text-paper',
  );
}

export function ViewTabs({ current }: { current: View }) {
  return (
    <nav
      aria-label={m.view_tabs_label()}
      className="inline-flex rounded-md border border-line bg-surface p-0.5"
    >
      <Link
        to="/"
        search={true}
        aria-current={current === 'table' ? 'page' : undefined}
        className={getTabClassName(current === 'table')}
      >
        {m.tab_table()}
      </Link>
      <Link
        to="/map"
        search={true}
        aria-current={current === 'map' ? 'page' : undefined}
        className={getTabClassName(current === 'map')}
      >
        {m.tab_map()}
      </Link>
    </nav>
  );
}
