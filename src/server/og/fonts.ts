import monoLatinMedium from '@fontsource/geist-mono/files/geist-mono-latin-500-normal.woff?url&inline';
import monoLatinExtMedium from '@fontsource/geist-mono/files/geist-mono-latin-ext-500-normal.woff?url&inline';
import sansLatinRegular from '@fontsource/inter-tight/files/inter-tight-latin-400-normal.woff?url&inline';
import sansLatinSemibold from '@fontsource/inter-tight/files/inter-tight-latin-600-normal.woff?url&inline';
import sansLatinExtRegular from '@fontsource/inter-tight/files/inter-tight-latin-ext-400-normal.woff?url&inline';
import sansLatinExtSemibold from '@fontsource/inter-tight/files/inter-tight-latin-ext-600-normal.woff?url&inline';
import type { Font } from 'satori';

export const SANS_FONT = 'Inter Tight';
export const MONO_FONT = 'Geist Mono';

const FONT_SOURCES: { name: string; weight: Font['weight']; dataUrl: string }[] = [
  { name: SANS_FONT, weight: 400, dataUrl: sansLatinRegular },
  { name: SANS_FONT, weight: 400, dataUrl: sansLatinExtRegular },
  { name: SANS_FONT, weight: 600, dataUrl: sansLatinSemibold },
  { name: SANS_FONT, weight: 600, dataUrl: sansLatinExtSemibold },
  { name: MONO_FONT, weight: 500, dataUrl: monoLatinMedium },
  { name: MONO_FONT, weight: 500, dataUrl: monoLatinExtMedium },
];

let fonts: Font[] | undefined;

function getFontData(dataUrl: string): Buffer {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

export function getShareCardFonts(): Font[] {
  fonts ??= FONT_SOURCES.map(({ name, weight, dataUrl }) => ({
    name,
    weight,
    style: 'normal',
    data: getFontData(dataUrl),
  }));
  return fonts;
}
