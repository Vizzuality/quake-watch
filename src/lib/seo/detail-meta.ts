import type { AnyRouteMatch } from '@tanstack/react-router';

import { getEarthquakeMeaning } from '@/lib/earthquakes/meaning';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getFullDateTimeLabel, getKmLabel } from '@/lib/format';
import { getEarthquakeMeaningLabel } from '@/lib/i18n/meaning-labels';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

type DetailMetaTag = { title: string } | { name: string; content: string };

const NOINDEX_META: DetailMetaTag = { name: 'robots', content: 'noindex' };

function getMagnitudeLabel(magnitude: number): string {
  return magnitude.toFixed(1);
}

function getPlaceLabel(place: string | null, locale: Locale): string {
  return place ?? m.place_unknown({}, { locale });
}

function getSentencePlaceLabel(place: string | null, locale: Locale): string {
  return getPlaceLabel(place, locale).replace(/\.$/, '');
}

function getUtcDateLabel(time: number, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(time);
}

export function getDetailTitle(earthquake: Earthquake, locale: Locale): string {
  return m.detail_meta_title(
    {
      magnitude: getMagnitudeLabel(earthquake.magnitude),
      place: getPlaceLabel(earthquake.place, locale),
      date: getUtcDateLabel(earthquake.time, locale),
    },
    { locale },
  );
}

export function getDetailDescription(earthquake: Earthquake, locale: Locale): string {
  const meaning = getEarthquakeMeaning({ ...earthquake, distanceKm: null });
  return m.detail_meta_description(
    {
      magnitude: getMagnitudeLabel(earthquake.magnitude),
      place: getSentencePlaceLabel(earthquake.place, locale),
      depth: getKmLabel(earthquake.depthKm, locale, 1),
      time: getFullDateTimeLabel(earthquake.time, locale, 'UTC'),
      feltReach: getEarthquakeMeaningLabel(meaning, undefined, locale),
    },
    { locale },
  );
}

export function getDetailMeta({
  status,
  earthquake,
  locale,
}: {
  status: AnyRouteMatch['status'];
  earthquake: Earthquake | undefined;
  locale: Locale;
}): DetailMetaTag[] {
  if (status !== 'success') return [NOINDEX_META];
  if (!earthquake) return [];
  return [
    { title: getDetailTitle(earthquake, locale) },
    { name: 'description', content: getDetailDescription(earthquake, locale) },
  ];
}
