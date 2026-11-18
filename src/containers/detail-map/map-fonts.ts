import latinLight from '@fontsource/space-grotesk/files/space-grotesk-latin-300-normal.woff2?url';
import latinRegular from '@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff2?url';
import latinMedium from '@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2?url';
import latinExtLight from '@fontsource/space-grotesk/files/space-grotesk-latin-ext-300-normal.woff2?url';
import latinExtRegular from '@fontsource/space-grotesk/files/space-grotesk-latin-ext-400-normal.woff2?url';
import latinExtMedium from '@fontsource/space-grotesk/files/space-grotesk-latin-ext-500-normal.woff2?url';

import type { MapFontUrls } from '@/lib/globe/map-style';

export const MAP_FONT_URLS: MapFontUrls = {
  regular: { latin: latinRegular, latinExt: latinExtRegular },
  medium: { latin: latinMedium, latinExt: latinExtMedium },
  light: { latin: latinLight, latinExt: latinExtLight },
};
