export function getCanHover(): boolean {
  return window.matchMedia('(hover: hover)').matches;
}
