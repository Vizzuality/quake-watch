const listeners = new Set<() => void>();
let isShown = false;

export function getIsSectionShown(): boolean {
  return isShown;
}

export function getIsSectionShownOnServer(): boolean {
  return false;
}

export function setSectionShown(next: boolean) {
  if (next === isShown) return;
  isShown = next;
  for (const listener of listeners) listener();
}

export function subscribeSectionShown(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
