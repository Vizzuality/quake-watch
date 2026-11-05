const LEGACY_MAP_PATH = /^\/(en|es)\/map\/?$/;
const LEGACY_DETAIL_PATH = /^\/(en|es)\/earthquakes\/(emsc|usgs)\/([^/]+)\/?$/;

export function getLegacyRedirect(url: URL): string | null {
  const map = LEGACY_MAP_PATH.exec(url.pathname);
  if (map) return `/${map[1]}${url.search}`;

  const detail = LEGACY_DETAIL_PATH.exec(url.pathname);
  if (detail) return `/${detail[1]}?quake=${detail[2]}:${detail[3]}`;

  return null;
}
