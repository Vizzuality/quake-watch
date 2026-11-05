import type { MagnitudeColors } from '@/lib/earthquakes/magnitude';

export type MapPalette = {
  canvas: string;
  fg: string;
  magnitude: MagnitudeColors;
};

export const BASEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';

let paletteCache: MapPalette | undefined;

function getToken(styles: CSSStyleDeclaration, name: string): string {
  return styles.getPropertyValue(`--color-${name}`).trim();
}

export function getMapPalette(): MapPalette {
  if (paletteCache) return paletteCache;
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
  if (palette.canvas) paletteCache = palette;
  return palette;
}
