const listeners = new Set<() => void>();
let zoom: number | undefined;

export function getGlobeZoom(): number | undefined {
  return zoom;
}

export function setGlobeZoom(next: number | undefined) {
  if (next === zoom) return;
  zoom = next;
  for (const listener of listeners) listener();
}

export function subscribeGlobeZoom(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
