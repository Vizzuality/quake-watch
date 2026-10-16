type Rect = { top: number; bottom: number };

export type FitPadding = { top: number; right: number; bottom: number; left: number };

export function getOverlayFitPadding({
  map,
  top,
  bottom,
  gap,
}: {
  map: Rect;
  top: Rect | null;
  bottom: Rect | null;
  gap: number;
}): FitPadding {
  const mapHeight = map.bottom - map.top;
  const topPadding = top ? Math.max(gap, top.bottom - map.top + gap) : gap;
  const bottomPadding = bottom ? Math.max(gap, map.bottom - bottom.top + gap) : gap;
  const free = mapHeight - topPadding - bottomPadding;
  if (free >= gap * 2) return { top: topPadding, right: gap, bottom: bottomPadding, left: gap };
  return { top: gap, right: gap, bottom: gap, left: gap };
}
