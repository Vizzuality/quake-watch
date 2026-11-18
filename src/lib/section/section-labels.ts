import { getMagnitudeValueLabel } from '@/lib/earthquakes/details-panel';
import { SOURCE_ADAPTERS } from '@/lib/earthquakes/query-options';
import type { EarthquakeSource } from '@/lib/earthquakes/search-schema';
import { getKmLabel } from '@/lib/format';
import { getIntlLocale } from '@/lib/i18n/intl-locale';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

import { type DepthScale, SECTION_FRAME } from './depth-scale';
import { type LayerId, SECTION_LOOK, type SectionFacts } from './section-model';

export type SectionAltInput = {
  depthKm: number;
  facts: SectionFacts;
  hasSlab: boolean;
  otherCount: number;
};

type Message = (inputs: Record<string, never>, options: { locale: Locale }) => string;

const LAYER_NAMES: Record<LayerId, Message> = {
  water: m.section_layer_water,
  sediments: m.section_layer_sediments,
  upper: m.section_layer_upper,
  middle: m.section_layer_middle,
  lower: m.section_layer_lower,
  mantle: m.section_layer_mantle,
};

const LAYER_PLACES: Record<LayerId, Message> = {
  water: m.section_alt_layer_water,
  sediments: m.section_alt_layer_sediments,
  upper: m.section_alt_layer_upper,
  middle: m.section_alt_layer_middle,
  lower: m.section_alt_layer_lower,
  mantle: m.section_alt_layer_mantle,
};

export const SECTION_LAYER_ORDER: readonly LayerId[] = [
  'water',
  'sediments',
  'upper',
  'middle',
  'lower',
  'mantle',
];

function getUpper(text: string, locale: Locale): string {
  return text.toLocaleUpperCase(getIntlLocale(locale));
}

export function getUpperLabel(message: Message, locale: Locale): string {
  return getUpper(message({}, { locale }), locale);
}

export function getLayerName(layer: LayerId, locale: Locale): string {
  return getUpperLabel(LAYER_NAMES[layer], locale);
}

export function getDepthTickLabel(depthKm: number, locale: Locale): string {
  if (depthKm === 0) return getUpper(m.section_sea_level({}, { locale }), locale);
  return getUpper(getKmLabel(depthKm, locale), locale);
}

export function getSectionHypocentreLabel(
  magnitude: number,
  depthKm: number,
  locale: Locale,
): string {
  const label = m.section_hypocentre_label(
    {
      magnitude: getMagnitudeValueLabel(magnitude, locale),
      depth: getKmLabel(depthKm, locale),
    },
    { locale },
  );
  return getUpper(label, locale);
}

export function getSectionFootnote(stretch: DepthScale['stretch'], locale: Locale): string {
  const format = new Intl.NumberFormat(getIntlLocale(locale), { maximumFractionDigits: 1 });
  const footnote = m.section_footnote(
    {
      length: getKmLabel(SECTION_FRAME.sliceKm, locale),
      top: format.format(stretch.top),
      below: format.format(stretch.below),
    },
    { locale },
  );
  return getUpper(footnote, locale);
}

export function getSectionBlurb(
  source: EarthquakeSource,
  hasSlab: boolean,
  locale: Locale,
): string {
  const inputs = { source: SOURCE_ADAPTERS[source].label };
  if (hasSlab) return m.section_blurb_slab(inputs, { locale });
  return m.section_blurb(inputs, { locale });
}

function getSurfaceSentence(elevationM: number, locale: Locale): string {
  const distance = getKmLabel(Math.abs(elevationM) / 1000, locale, 1);
  if (elevationM < 0) return m.section_alt_sea({ depth: distance }, { locale });
  return m.section_alt_land({ height: distance }, { locale });
}

function getSlabSentence({ facts, hasSlab }: SectionAltInput, locale: Locale): string {
  if (facts.slabDepthKm !== null) {
    return m.section_alt_slab({ depth: getKmLabel(facts.slabDepthKm, locale) }, { locale });
  }
  if (hasSlab) return m.section_alt_slab_nearby({}, { locale });
  return m.section_alt_no_slab({}, { locale });
}

function getOthersSentence(count: number, locale: Locale): string | null {
  if (count === 0) return null;
  const inputs = {
    count: new Intl.NumberFormat(getIntlLocale(locale)).format(count),
    distance: getKmLabel(SECTION_LOOK.corridorKm, locale),
  };
  const isOne = new Intl.PluralRules(getIntlLocale(locale)).select(count) === 'one';
  if (isOne) return m.section_alt_others_one(inputs, { locale });
  return m.section_alt_others_other(inputs, { locale });
}

export function getSectionAlt(input: SectionAltInput, locale: Locale): string {
  const { depthKm, facts, otherCount } = input;
  const intro = m.section_alt_intro(
    {
      length: getKmLabel(SECTION_FRAME.sliceKm, locale),
      depth: getKmLabel(depthKm, locale),
      layer: LAYER_PLACES[facts.layer]({}, { locale }),
    },
    { locale },
  );
  return [
    intro,
    getSurfaceSentence(facts.surfaceElevationM, locale),
    m.section_alt_crust({ thickness: getKmLabel(facts.crustThicknessKm, locale) }, { locale }),
    getSlabSentence(input, locale),
    getOthersSentence(otherCount, locale),
  ]
    .filter((sentence) => sentence !== null)
    .join(' ');
}
