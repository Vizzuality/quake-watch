import { rootRouteId } from '@tanstack/react-router';
import type { AnyRouteMatch } from '@tanstack/react-router';

import { m } from '@/paraglide/messages';

type PageTitleMatch = Pick<AnyRouteMatch, 'routeId' | 'status'>;

export function getPageTitle(matches: PageTitleMatch[]): string {
  const leaf = matches.at(-1);
  if (matches.some(({ status }) => status === 'error')) return m.page_title_error();
  if (!leaf || leaf.routeId === rootRouteId) return m.page_title_not_found();
  if (leaf.routeId === '/') return m.page_title_home();
  return m.app_title();
}
