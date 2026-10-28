import { rootRouteId } from '@tanstack/react-router';
import type { AnyRouteMatch } from '@tanstack/react-router';

import { m } from '@/paraglide/messages';

type PageTitleMatch = Pick<AnyRouteMatch, 'routeId' | 'status' | 'search'>;

function getHomeTitle(place: unknown): string {
  return typeof place === 'string' ? m.page_title_home_near({ place }) : m.page_title_home();
}

export function getPageTitle(matches: PageTitleMatch[]): string {
  const leaf = matches.at(-1);
  if (matches.some(({ status }) => status === 'error')) return m.page_title_error();
  if (!leaf || leaf.routeId === rootRouteId) return m.page_title_not_found();
  if (leaf.status === 'notFound') return m.page_title_earthquake_not_found();
  if (leaf.routeId === '/') return getHomeTitle(leaf.search.place);
  if (leaf.routeId === '/map') return m.page_title_map();
  return m.app_title();
}
