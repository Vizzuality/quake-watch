import type { Rgb } from '@/lib/map/shaking-waves';

const RGB_PATTERN = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/;

export type ShakemapPalette = { colors: readonly string[]; extent: readonly [number, number] };

function getRgbFromCss(color: string): Rgb {
  const [, red, green, blue] = RGB_PATTERN.exec(color) ?? [];
  return [Number(red) / 255, Number(green) / 255, Number(blue) / 255];
}

export function getPaletteColor(palette: ShakemapPalette, mmi: number): Rgb {
  const [low, high] = palette.extent;
  const clamped = Math.min(high, Math.max(low, mmi));
  const position = ((clamped - low) / (high - low)) * (palette.colors.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.min(palette.colors.length - 1, lowerIndex + 1);
  const weight = position - lowerIndex;
  const from = getRgbFromCss(palette.colors[lowerIndex]);
  const to = getRgbFromCss(palette.colors[upperIndex]);
  return [
    from[0] + (to[0] - from[0]) * weight,
    from[1] + (to[1] - from[1]) * weight,
    from[2] + (to[2] - from[2]) * weight,
  ];
}
