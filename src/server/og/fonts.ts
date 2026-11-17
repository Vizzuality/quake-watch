import sansLatinRegular from '@fontsource/inter-tight/files/inter-tight-latin-400-normal.woff?url&inline';
import sansLatinSemibold from '@fontsource/inter-tight/files/inter-tight-latin-600-normal.woff?url&inline';
import sansLatinExtRegular from '@fontsource/inter-tight/files/inter-tight-latin-ext-400-normal.woff?url&inline';
import sansLatinExtSemibold from '@fontsource/inter-tight/files/inter-tight-latin-ext-600-normal.woff?url&inline';
import groteskLatinLight from '@fontsource/space-grotesk/files/space-grotesk-latin-300-normal.woff?url&inline';
import groteskLatinRegular from '@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff?url&inline';
import groteskLatinMedium from '@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff?url&inline';
import groteskLatinBold from '@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff?url&inline';
import groteskLatinExtLight from '@fontsource/space-grotesk/files/space-grotesk-latin-ext-300-normal.woff?url&inline';
import groteskLatinExtRegular from '@fontsource/space-grotesk/files/space-grotesk-latin-ext-400-normal.woff?url&inline';
import groteskLatinExtMedium from '@fontsource/space-grotesk/files/space-grotesk-latin-ext-500-normal.woff?url&inline';
import groteskLatinExtBold from '@fontsource/space-grotesk/files/space-grotesk-latin-ext-700-normal.woff?url&inline';
import type { Font } from 'satori';

export const SANS_FONT = 'Inter Tight';
export const GROTESK_FONT = 'Space Grotesk';

const FONT_SOURCES: { name: string; weight: Font['weight']; dataUrl: string }[] = [
  { name: SANS_FONT, weight: 400, dataUrl: sansLatinRegular },
  { name: SANS_FONT, weight: 400, dataUrl: sansLatinExtRegular },
  { name: SANS_FONT, weight: 600, dataUrl: sansLatinSemibold },
  { name: SANS_FONT, weight: 600, dataUrl: sansLatinExtSemibold },
  { name: GROTESK_FONT, weight: 300, dataUrl: groteskLatinLight },
  { name: GROTESK_FONT, weight: 300, dataUrl: groteskLatinExtLight },
  { name: GROTESK_FONT, weight: 400, dataUrl: groteskLatinRegular },
  { name: GROTESK_FONT, weight: 400, dataUrl: groteskLatinExtRegular },
  { name: GROTESK_FONT, weight: 500, dataUrl: groteskLatinMedium },
  { name: GROTESK_FONT, weight: 500, dataUrl: groteskLatinExtMedium },
  { name: GROTESK_FONT, weight: 700, dataUrl: groteskLatinBold },
  { name: GROTESK_FONT, weight: 700, dataUrl: groteskLatinExtBold },
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
