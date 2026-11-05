import { getMapPalette } from '@/lib/theme/map-palette';
import type { MapPalette } from '@/lib/theme/map-palette';

export function useMapPalette(): MapPalette {
  return getMapPalette();
}
