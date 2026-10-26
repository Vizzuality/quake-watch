const DEFAULT_SITE_URL = 'https://quake-watch.up.railway.app';

export function getSiteUrlFromEnv(raw: string | undefined): string {
  if (!raw) return DEFAULT_SITE_URL;
  return raw.replace(/\/+$/, '');
}

export function getSiteUrl(): string {
  return getSiteUrlFromEnv(__PUBLIC_SITE_URL__);
}
