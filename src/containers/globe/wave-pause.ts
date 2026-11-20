import { useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const listeners = new Set<() => void>();
let choice: boolean | null = null;

export function getIsWavePaused(): boolean {
  return choice ?? window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getIsWavePausedOnServer(): boolean {
  return false;
}

export function setWavePaused(next: boolean | null) {
  choice = next;
  for (const listener of listeners) listener();
}

export function subscribeWavePause(listener: () => void): () => void {
  const motion = window.matchMedia(REDUCED_MOTION_QUERY);
  listeners.add(listener);
  motion.addEventListener('change', listener);
  return () => {
    listeners.delete(listener);
    motion.removeEventListener('change', listener);
  };
}

export function useIsWavePaused(): boolean {
  return useSyncExternalStore(subscribeWavePause, getIsWavePaused, getIsWavePausedOnServer);
}
