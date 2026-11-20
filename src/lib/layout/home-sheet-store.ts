const listeners = new Set<() => void>();
let isOpen = false;

export function getIsHomeSheetOpen(): boolean {
  return isOpen;
}

export function getIsHomeSheetOpenOnServer(): boolean {
  return false;
}

export function setHomeSheetOpen(next: boolean) {
  if (next === isOpen) return;
  isOpen = next;
  for (const listener of listeners) listener();
}

export function subscribeHomeSheet(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let handle: HTMLElement | null = null;

export function setHomeSheetHandle(element: HTMLElement | null) {
  handle = element;
}

export function focusHomeSheetHandle() {
  handle?.focus();
}
