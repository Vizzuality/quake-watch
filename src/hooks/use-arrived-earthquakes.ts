import { useEffect, useRef, useState } from 'react';

import { getArrivedIds } from '@/lib/earthquakes/arrivals';

const ARRIVAL_HIGHLIGHT_MS = 8_000;

export function useArrivedEarthquakes(
  searchKey: string,
  ids: readonly string[] | undefined,
): ReadonlySet<string> {
  const seen = useRef<{ searchKey: string; ids: ReadonlySet<string> } | null>(null);
  const [arrived, setArrived] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!ids) return;
    const previous = seen.current?.searchKey === searchKey ? seen.current.ids : null;
    seen.current = { searchKey, ids: new Set(ids) };
    const next = getArrivedIds(previous, ids);
    setArrived(next);
    if (next.size === 0) return;
    const timeout = window.setTimeout(() => setArrived(new Set()), ARRIVAL_HIGHLIGHT_MS);
    return () => window.clearTimeout(timeout);
  }, [searchKey, ids]);

  return arrived;
}
