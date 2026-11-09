import { LAND_MASK_BASE64, LAND_MASK_POINT_COUNT } from './land-mask.data';

export function getLandMask(): Uint8Array {
  const bits = Uint8Array.from(atob(LAND_MASK_BASE64), (char) => char.charCodeAt(0));
  const mask = new Uint8Array(LAND_MASK_POINT_COUNT);
  for (let i = 0; i < LAND_MASK_POINT_COUNT; i++) mask[i] = (bits[i >> 3] >> (i & 7)) & 1;
  return mask;
}
