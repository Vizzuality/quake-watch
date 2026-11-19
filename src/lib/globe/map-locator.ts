import { getRotatedVector } from './sphere';

export const MINI_GLOBE_LOOK = {
  radiusPx: 46,
  marginPx: 4,
  minRectPx: 4,
  maxHalfAngle: 1.3,
  minFacing: 0.02,
  seaStride: 6,
  landBaseAlpha: 0.25,
  landFacingAlpha: 0.5,
  seaFacingAlpha: 0.25,
} as const;

const RADIANS_PER_DEGREE = Math.PI / 180;

export type MiniGlobeDot = { x: number; y: number; alpha: number; isLand: boolean };
export type MapBounds = { west: number; east: number; south: number; north: number };

function getDotAlpha(isLand: boolean, facing: number): number {
  const { landBaseAlpha, landFacingAlpha, seaFacingAlpha } = MINI_GLOBE_LOOK;
  if (isLand) return landBaseAlpha + landFacingAlpha * facing;
  return seaFacingAlpha * facing;
}

export function getMiniGlobeDots(
  lat: number,
  lon: number,
  points: Float32Array,
  landMask: Uint8Array,
): MiniGlobeDot[] {
  const dots: MiniGlobeDot[] = [];
  const latRadians = lat * RADIANS_PER_DEGREE;
  const lonRadians = lon * RADIANS_PER_DEGREE;
  for (let index = 0; index < landMask.length; index += 2) {
    const isLand = landMask[index] === 1;
    if (!isLand && index % MINI_GLOBE_LOOK.seaStride !== 0) continue;
    const [x, y, z] = getRotatedVector(
      [points[index * 3], points[index * 3 + 1], points[index * 3 + 2]],
      lonRadians,
      latRadians,
    );
    if (z <= MINI_GLOBE_LOOK.minFacing) continue;
    dots.push({ x, y: -y, alpha: getDotAlpha(isLand, z), isLand });
  }
  return dots;
}

function getHalfSidePx(halfAngle: number): number {
  const { radiusPx, minRectPx, maxHalfAngle } = MINI_GLOBE_LOOK;
  return Math.max(minRectPx, Math.sin(Math.min(maxHalfAngle, halfAngle)) * radiusPx);
}

export function getMiniGlobeRect(
  { west, east, south, north }: MapBounds,
  lat: number,
): { halfWidthPx: number; halfHeightPx: number } {
  const cosLat = Math.cos(lat * RADIANS_PER_DEGREE);
  return {
    halfWidthPx: getHalfSidePx(((east - west) / 2) * cosLat * RADIANS_PER_DEGREE),
    halfHeightPx: getHalfSidePx(((north - south) / 2) * RADIANS_PER_DEGREE),
  };
}
