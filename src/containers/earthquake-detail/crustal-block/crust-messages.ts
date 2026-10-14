import type { BandKind } from '@/lib/crust/scene';
import { getKmLabel } from '@/lib/format';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

export const BAND_NAMES: Record<BandKind, () => string> = {
  water: m.crustal_block_kind_water,
  ice: m.crustal_block_kind_ice,
  'upper-sediments': m.crustal_block_kind_upper_sediments,
  'middle-sediments': m.crustal_block_kind_middle_sediments,
  'lower-sediments': m.crustal_block_kind_lower_sediments,
  'upper-crust': m.crustal_block_kind_upper_crust,
  'middle-crust': m.crustal_block_kind_middle_crust,
  'lower-crust': m.crustal_block_kind_lower_crust,
  'upper-mantle': m.crustal_block_kind_upper_mantle,
  'transition-zone': m.crustal_block_kind_transition_zone,
  'lower-mantle': m.crustal_block_kind_lower_mantle,
};

export const BAND_EXPLANATIONS: Record<BandKind, () => string> = {
  water: m.crustal_block_explain_water,
  ice: m.crustal_block_explain_ice,
  'upper-sediments': m.crustal_block_explain_upper_sediments,
  'middle-sediments': m.crustal_block_explain_middle_sediments,
  'lower-sediments': m.crustal_block_explain_lower_sediments,
  'upper-crust': m.crustal_block_explain_upper_crust,
  'middle-crust': m.crustal_block_explain_middle_crust,
  'lower-crust': m.crustal_block_explain_lower_crust,
  'upper-mantle': m.crustal_block_explain_upper_mantle,
  'transition-zone': m.crustal_block_explain_transition_zone,
  'lower-mantle': m.crustal_block_explain_lower_mantle,
};

export function getDistanceLabel(km: number): string {
  return getKmLabel(km, getLocale(), 1);
}

function getPreciseDistanceLabel(km: number): string {
  const fractionDigits = Math.abs(km) < 1 ? 2 : 1;
  return getKmLabel(km, getLocale(), fractionDigits);
}

export function getDepthText(depthKm: number): string {
  const fractionDigits = Math.abs(depthKm) < 1 ? 2 : 1;
  const factor = 10 ** fractionDigits;
  const roundedKm = Math.round(depthKm * factor) / factor;
  if (roundedKm < 0) {
    return m.crustal_block_depth_above({ distance: getPreciseDistanceLabel(-roundedKm) });
  }
  if (roundedKm === 0) return getDistanceLabel(0);
  return m.crustal_block_depth_below({ distance: getPreciseDistanceLabel(roundedKm) });
}
