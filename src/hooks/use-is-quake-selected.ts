import { useSearch } from '@tanstack/react-router';

export function useIsQuakeSelected(): boolean {
  return useSearch({ strict: false, select: (search) => search.quake !== undefined });
}
