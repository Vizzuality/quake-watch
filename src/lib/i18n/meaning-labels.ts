import type { EarthquakeMeaning } from '@/lib/earthquakes/meaning';
import { getKmLabel } from '@/lib/format';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

import { getIntensityLevelLabel } from './tooltip-labels';

function getUnbreakableKmLabel(km: number, locale: Locale): string {
  return getKmLabel(km, locale).replace(/\s/g, ' ');
}

function getAtPlaceLabel(
  meaning: Extract<EarthquakeMeaning, { kind: 'at-place' }>,
  place: string | undefined,
  locale: Locale,
): string {
  const isNotFelt = meaning.key === 'not_felt';
  if (place === undefined && isNotFelt) return m.meaning_at_point_not_felt({}, { locale });
  if (place === undefined) {
    const level = getIntensityLevelLabel(meaning.key, locale).toLocaleLowerCase(locale);
    return m.meaning_at_point({ level, roman: meaning.roman }, { locale });
  }
  if (isNotFelt) return m.meaning_at_place_not_felt({ place }, { locale });
  const level = getIntensityLevelLabel(meaning.key, locale).toLocaleLowerCase(locale);
  return m.meaning_at_place({ level, roman: meaning.roman, place }, { locale });
}

export function getEarthquakeMeaningLabel(
  meaning: EarthquakeMeaning,
  place: string | undefined,
  locale: Locale,
): string {
  if (meaning.kind === 'not-felt') return m.meaning_not_felt({}, { locale });
  if (meaning.kind === 'felt-reach') {
    return m.meaning_felt_reach(
      { distance: getUnbreakableKmLabel(meaning.reachKm, locale) },
      { locale },
    );
  }
  return getAtPlaceLabel(meaning, place, locale);
}
