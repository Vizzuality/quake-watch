import { useSyncExternalStore } from 'react';

import { getMapPalette } from '@/lib/theme/map-palette';
import type { MapPalette } from '@/lib/theme/map-palette';
import {
  getCurrentResolvedTheme,
  getCurrentThemePreference,
  subscribeToTheme,
} from '@/lib/theme/theme';
import type { ResolvedTheme, ThemePreference } from '@/lib/theme/theme';

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribeToTheme, getCurrentThemePreference, () => 'system');
}

export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribeToTheme, getCurrentResolvedTheme, () => 'dark');
}

export function useMapPalette(): MapPalette {
  return getMapPalette(useResolvedTheme());
}
