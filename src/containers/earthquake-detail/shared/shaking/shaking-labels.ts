import { getIntensityLevel } from '@/lib/earthquakes/intensity';
import { getIntensityLevelLabel } from '@/lib/i18n/tooltip-labels';
import type { Rgb } from '@/lib/map/shaking-waves';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

export function getIntensityShortLabel(mmi: number, locale: Locale): string {
  const { roman, key } = getIntensityLevel(mmi);
  return `${roman} · ${getIntensityLevelLabel(key, locale)}`;
}

export function getCssColor([red, green, blue]: Rgb): string {
  return `rgb(${Math.round(red * 255)}, ${Math.round(green * 255)}, ${Math.round(blue * 255)})`;
}

export function getPlayLabel(playing: boolean): string {
  return playing ? m.detail_shakemap_pause() : m.detail_shakemap_play();
}

export function getSwatchClassName(filled: boolean): string {
  return filled
    ? 'size-3 shrink-0 rounded-xs ring-1 ring-line-strong'
    : 'h-1 w-3 shrink-0 rounded-full ring-1 ring-line-strong';
}
