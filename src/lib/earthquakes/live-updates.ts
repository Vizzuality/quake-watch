const listeners = new Set<() => void>();
let isPaused = false;

export function getIsLiveUpdatesPaused(): boolean {
  return isPaused;
}

export function getIsLiveUpdatesPausedOnServer(): boolean {
  return false;
}

export function setLiveUpdatesPaused(next: boolean) {
  if (next === isPaused) return;
  isPaused = next;
  for (const listener of listeners) listener();
}

export function subscribeLiveUpdates(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
