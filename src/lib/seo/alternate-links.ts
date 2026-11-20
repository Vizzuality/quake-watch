import { EARTHQUAKE_SEARCH_DEFAULTS } from '@/lib/earthquakes/search-schema';
import { deLocalizeUrl, getLocale, localizeUrl, locales } from '@/paraglide/runtime';
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

function getHrefWithQuake(url: URL, quake: string | undefined): string {
  if (quake) url.search = `?quake=${quake}`;
  return url.href;
}

function getLocalizedHref(pathname: string, locale: Locale, quake: string | undefined): string {
  return getHrefWithQuake(localizeUrl(new URL(pathname, getSiteUrl()), { locale }), quake);
}

function getLocaleNegotiatedHref(pathname: string, quake: string | undefined): string {
  return getHrefWithQuake(deLocalizeUrl(new URL(pathname, getSiteUrl())), quake);
}

export function getAlternateLinks({
  pathname,
  search,
  quake,
}: {
  pathname: string;
  search: Record<string, unknown>;
  quake?: string;
}): AlternateLinks {
  return {
    canonical: getLocalizedHref(pathname, getLocale(), quake),
    alternates: [
      ...locales.map((locale) => ({
        hreflang: locale,
        href: getLocalizedHref(pathname, locale, quake),
      })),
      { hreflang: 'x-default', href: getLocaleNegotiatedHref(pathname, quake) },
    ],
    isNoindex: Object.entries(search).some(isNonDefaultParam),
  };
}
