import { Link } from '@tanstack/react-router';

import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

type View = 'table' | 'map';

function getTabClassName(isCurrent: boolean): string {
  return cn(
    'rounded-xs px-3 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg',
    isCurrent ? 'bg-fg text-canvas' : 'text-muted hover:text-fg',
  );
}

export function ViewTabs({ current }: { current: View }) {
  return (
    <nav
      aria-label={m.view_tabs_label()}
      className="inline-flex rounded-sm border border-line-strong bg-surface p-0.5"
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
