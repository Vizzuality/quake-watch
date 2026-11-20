import type { Earthquake } from '@/lib/earthquakes/types';

type GlobeFlyToListener = (earthquake: Earthquake) => void;

const listeners = new Set<GlobeFlyToListener>();

export function requestGlobeFlyTo(earthquake: Earthquake) {
  for (const listener of listeners) listener(earthquake);
}

export function subscribeGlobeFlyTo(listener: GlobeFlyToListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
