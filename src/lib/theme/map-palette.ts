import type { MagnitudeColors } from '@/lib/earthquakes/magnitude';

import type { ResolvedTheme } from './theme';

export type MapPalette = {
  canvas: string;
  fg: string;
  magnitude: MagnitudeColors;
};

const BASEMAP_STYLE_URLS: Record<ResolvedTheme, string> = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

const paletteCache = new Map<ResolvedTheme, MapPalette>();

function getToken(styles: CSSStyleDeclaration, name: string): string {
  return styles.getPropertyValue(`--color-${name}`).trim();
}

export function getBasemapStyleUrl(theme: ResolvedTheme): string {
  return BASEMAP_STYLE_URLS[theme];
}

export function getMapPalette(theme: ResolvedTheme): MapPalette {
  const cached = paletteCache.get(theme);
  if (cached) return cached;
  const styles = getComputedStyle(document.documentElement);
  const palette: MapPalette = {
    canvas: getToken(styles, 'canvas'),
    fg: getToken(styles, 'fg'),
    magnitude: [
      getToken(styles, 'mag-1'),
      getToken(styles, 'mag-2'),
      getToken(styles, 'mag-3'),
      getToken(styles, 'mag-4'),
      getToken(styles, 'mag-5'),
      getToken(styles, 'mag-6'),
    ],
  };
  if (palette.canvas) paletteCache.set(theme, palette);
  return palette;
}
