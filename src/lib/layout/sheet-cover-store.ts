const listeners = new Set<() => void>();
const coveringSheets = new Set<string>();

export function getIsMapCovered(): boolean {
  return coveringSheets.size > 0;
}

export function getIsMapCoveredOnServer(): boolean {
  return false;
}

export function setSheetCovering(id: string, isCovering: boolean) {
  const wasCovered = getIsMapCovered();
  if (isCovering) coveringSheets.add(id);
  else coveringSheets.delete(id);
  if (getIsMapCovered() === wasCovered) return;
  for (const listener of listeners) listener();
}

export function subscribeSheetCover(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
