import type { Earthquake } from '@/lib/earthquakes/types';
import { m } from '@/paraglide/messages';
import { localizeUrl } from '@/paraglide/runtime';
import type { Locale } from '@/paraglide/runtime';

import { getSiteUrl } from './site-url';

export type OpenGraphTag =
  | { property: string; content: string }
  | { name: string; content: string };

export const SHARE_IMAGE_WIDTH = 1200;
export const SHARE_IMAGE_HEIGHT = 630;

const OG_LOCALES: Record<Locale, string> = { en: 'en_US', es: 'es_ES' };

function getLocalizedShareImageUrl(pathname: string, locale: Locale): string {
  return localizeUrl(new URL(pathname, getSiteUrl()), { locale }).href;
}

export function getSiteShareImageUrl(locale: Locale): string {
  return getLocalizedShareImageUrl('/og/site.png', locale);
}

export function getEarthquakeShareImageUrl(
  earthquake: Pick<Earthquake, 'source' | 'id'>,
  locale: Locale,
): string {
  return getLocalizedShareImageUrl(
    `/og/earthquakes/${earthquake.source}/${encodeURIComponent(earthquake.id)}.png`,
    locale,
  );
}

function getImageTags(url: string, alt: string): OpenGraphTag[] {
  return [
    { property: 'og:image', content: url },
    { property: 'og:image:type', content: 'image/png' },
    { property: 'og:image:width', content: String(SHARE_IMAGE_WIDTH) },
    { property: 'og:image:height', content: String(SHARE_IMAGE_HEIGHT) },
    { property: 'og:image:alt', content: alt },
    { name: 'twitter:image:alt', content: alt },
  ];
}

export function getSiteOpenGraphMeta({
  title,
  url,
  locale,
}: {
  title: string;
  url: string;
  locale: Locale;
}): OpenGraphTag[] {
  const alternateLocale: Locale = locale === 'es' ? 'en' : 'es';
  return [
    { property: 'og:site_name', content: m.app_title({}, { locale }) },
    { property: 'og:type', content: 'website' },
    { property: 'og:locale', content: OG_LOCALES[locale] },
    { property: 'og:locale:alternate', content: OG_LOCALES[alternateLocale] },
    { property: 'og:url', content: url },
    { property: 'og:title', content: title },
    { property: 'og:description', content: m.app_description({}, { locale }) },
    { name: 'twitter:card', content: 'summary_large_image' },
    ...getImageTags(
      getSiteShareImageUrl(locale),
      `${m.app_title({}, { locale })}: ${m.og_site_headline({}, { locale })} ${m.og_site_history({}, { locale })}`,
    ),
  ];
}

export function getEarthquakeOpenGraphMeta({
  earthquake,
  title,
  description,
  dateLabel,
  locale,
}: {
  earthquake: Earthquake;
  title: string;
  description: string;
  dateLabel: string;
  locale: Locale;
}): OpenGraphTag[] {
  const alt = m.og_image_alt_detail(
    {
      magnitude: earthquake.magnitude.toFixed(1),
      place: earthquake.place ?? m.place_unknown({}, { locale }),
      date: dateLabel,
    },
    { locale },
  );
  return [
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    ...getImageTags(getEarthquakeShareImageUrl(earthquake, locale), alt),
  ];
}
