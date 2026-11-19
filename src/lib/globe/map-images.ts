export const TOWN_ICON_ID = 'qw-town';
export const MAP_IMAGE_PIXEL_RATIO = 2;

export type MapImage = { id: string; width: number; height: number; data: Uint8Array };

const TOWN_RING = { sizePx: 4, radiusPx: 1.5, strokePx: 1 } as const;
const TOWN_RGB = [230, 228, 245] as const;

function getCoverage(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function getTownIcon(): MapImage {
  const { sizePx, radiusPx, strokePx } = TOWN_RING;
  const size = sizePx * MAP_IMAGE_PIXEL_RATIO;
  const centre = size / 2;
  const radius = radiusPx * MAP_IMAGE_PIXEL_RATIO;
  const halfStroke = (strokePx * MAP_IMAGE_PIXEL_RATIO) / 2;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x + 0.5 - centre, y + 0.5 - centre);
      const coverage = getCoverage(halfStroke + 0.5 - Math.abs(distance - radius));
      if (coverage <= 0) continue;
      data.set([...TOWN_RGB, Math.round(coverage * 255)], (y * size + x) * 4);
    }
  }
  return { id: TOWN_ICON_ID, width: size, height: size, data };
}

export function getMapImages(): MapImage[] {
  return [getTownIcon()];
}
