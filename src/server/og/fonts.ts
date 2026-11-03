import monoLatinRegular from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff?url&inline';
import monoLatinSemibold from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff?url&inline';
import monoLatinExtRegular from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-ext-400-normal.woff?url&inline';
import monoLatinExtSemibold from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-ext-600-normal.woff?url&inline';
import sansLatinRegular from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff?url&inline';
import sansLatinSemibold from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff?url&inline';
import sansLatinExtRegular from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-ext-400-normal.woff?url&inline';
import sansLatinExtSemibold from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-ext-600-normal.woff?url&inline';
import type { Font } from 'satori';

export const SANS_FONT = 'IBM Plex Sans';
export const MONO_FONT = 'IBM Plex Mono';

const FONT_SOURCES: { name: string; weight: Font['weight']; dataUrl: string }[] = [
  { name: SANS_FONT, weight: 400, dataUrl: sansLatinRegular },
  { name: SANS_FONT, weight: 400, dataUrl: sansLatinExtRegular },
  { name: SANS_FONT, weight: 600, dataUrl: sansLatinSemibold },
  { name: SANS_FONT, weight: 600, dataUrl: sansLatinExtSemibold },
  { name: MONO_FONT, weight: 400, dataUrl: monoLatinRegular },
  { name: MONO_FONT, weight: 400, dataUrl: monoLatinExtRegular },
  { name: MONO_FONT, weight: 600, dataUrl: monoLatinSemibold },
  { name: MONO_FONT, weight: 600, dataUrl: monoLatinExtSemibold },
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
