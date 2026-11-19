import type { Earthquake } from '@/lib/earthquakes/types';

type GlobeSelectListener = (earthquake: Earthquake) => void;

const listeners = new Set<GlobeSelectListener>();

export function requestGlobeSelect(earthquake: Earthquake): boolean {
  for (const listener of listeners) listener(earthquake);
  return listeners.size > 0;
}

export function subscribeGlobeSelect(listener: GlobeSelectListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
