import { EARTHQUAKE_SEARCH_DEFAULTS } from '@/lib/earthquakes/search-schema';
import { getLocale, localizeUrl } from '@/paraglide/runtime';
import type { Locale } from '@/paraglide/runtime';

import { getSiteUrl } from './site-url';

type AlternateLink = { hreflang: Locale | 'x-default'; href: string };

export type AlternateLinks = {
  canonical: string;
  alternates: AlternateLink[];
  isNoindex: boolean;
};

const DEFAULTS: Record<string, unknown> = EARTHQUAKE_SEARCH_DEFAULTS;

function isNonDefaultParam([key, value]: [string, unknown]): boolean {
  if (value === undefined) return false;
  return !(key in DEFAULTS) || DEFAULTS[key] !== value;
}

function getLocalizedHref(pathname: string, locale: Locale): string {
  return localizeUrl(new URL(pathname, getSiteUrl()), { locale }).href;
}

export function getAlternateLinks({
  pathname,
  search,
}: {
  pathname: string;
  search: Record<string, unknown>;
}): AlternateLinks {
  const enHref = getLocalizedHref(pathname, 'en');

  return {
    canonical: getLocalizedHref(pathname, getLocale()),
    alternates: [
      { hreflang: 'en', href: enHref },
      { hreflang: 'es', href: getLocalizedHref(pathname, 'es') },
      { hreflang: 'x-default', href: enHref },
    ],
    isNoindex: Object.entries(search).some(isNonDefaultParam),
  };
}
