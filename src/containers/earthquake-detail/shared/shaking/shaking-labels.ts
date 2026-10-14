import { getIntensityLevel } from '@/lib/earthquakes/intensity';
import { getIntensityLevelLabel } from '@/lib/i18n/tooltip-labels';
import type { Rgb } from '@/lib/map/shaking-waves';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

type HintKey = `${'fine' | 'coarse'}-${'idle' | 'active'}`;

const HINTS: Record<HintKey, () => string> = {
  'fine-idle': m.detail_shakemap_hint_idle,
  'fine-active': m.detail_shakemap_hint_active,
  'coarse-idle': m.detail_shakemap_hint_touch_idle,
  'coarse-active': m.detail_shakemap_hint_touch_active,
};

export function getIntensityShortLabel(mmi: number, locale: Locale): string {
  const { roman, key } = getIntensityLevel(mmi);
  return `${roman} · ${getIntensityLevelLabel(key, locale)}`;
}

export function getCssColor([red, green, blue]: Rgb): string {
  return `rgb(${Math.round(red * 255)}, ${Math.round(green * 255)}, ${Math.round(blue * 255)})`;
}

function getPointerKind(coarsePointer: boolean): 'fine' | 'coarse' {
  return coarsePointer ? 'coarse' : 'fine';
}

function getActivityKind(active: boolean): 'idle' | 'active' {
  return active ? 'active' : 'idle';
}

export function getMapHint(coarsePointer: boolean, active: boolean): string {
  return HINTS[`${getPointerKind(coarsePointer)}-${getActivityKind(active)}`]();
}

export function getPlayLabel(playing: boolean): string {
  return playing ? m.detail_shakemap_pause() : m.detail_shakemap_play();
}

export function getSwatchClassName(filled: boolean): string {
  return filled
    ? 'size-3 shrink-0 rounded-sm ring-1 ring-ink/40'
    : 'h-[3px] w-3 shrink-0 rounded-full';
}
