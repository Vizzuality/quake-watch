const TOGGLE_DISTANCE_PX = 40;
const TOGGLE_VELOCITY_PX_PER_MS = 0.5;

export function isSheetDragToggle(deltaY: number, durationMs: number, isOpen: boolean): boolean {
  const towardsOther = isOpen ? deltaY : -deltaY;
  if (towardsOther <= 0) return false;
  const velocity = towardsOther / Math.max(durationMs, 1);
  return towardsOther > TOGGLE_DISTANCE_PX || velocity > TOGGLE_VELOCITY_PX_PER_MS;
}
