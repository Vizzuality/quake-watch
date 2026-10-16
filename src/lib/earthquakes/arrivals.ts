export function getArrivedIds(previous: ReadonlySet<string> | null, current: readonly string[]) {
  if (!previous) return new Set<string>();
  return new Set(current.filter((id) => !previous.has(id)));
}
