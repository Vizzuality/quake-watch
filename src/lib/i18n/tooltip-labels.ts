import type { IntensityLevelKey } from '@/lib/earthquakes/intensity';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

type MessageOptions = { locale: Locale };

const INTENSITY_LEVEL_LABELS: Record<
  IntensityLevelKey,
  (inputs: Record<string, never>, options: MessageOptions) => string
> = {
  not_felt: m.intensity_level_not_felt,
  weak: m.intensity_level_weak,
  light: m.intensity_level_light,
  moderate: m.intensity_level_moderate,
  strong: m.intensity_level_strong,
  very_strong: m.intensity_level_very_strong,
  severe: m.intensity_level_severe,
  violent: m.intensity_level_violent,
  extreme: m.intensity_level_extreme,
};

export function getIntensityLevelLabel(key: IntensityLevelKey, locale: Locale): string {
  return INTENSITY_LEVEL_LABELS[key]({}, { locale });
}

export function getNumberLabel(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
}

export function getDateTimeLabel(time: number, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(time);
}
