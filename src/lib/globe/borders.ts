import {
  BORDER_SEGMENT_COUNT,
  BORDER_SEGMENTS_BASE64,
  BORDER_STEPS_PER_DEGREE,
} from './borders.data';
import { getLatLonVector } from './sphere';

const XYZ_STRIDE = 3;
const LON_LAT_STRIDE = 2;

function getInt16Values(base64: string): Int16Array {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  return Int16Array.from({ length: bytes.length / 2 }, (_, index) =>
    view.getInt16(index * 2, true),
  );
}

export function getBorderSegments(): Float32Array {
  const coordinates = getInt16Values(BORDER_SEGMENTS_BASE64);
  const vertexCount = BORDER_SEGMENT_COUNT * 2;
  const segments = new Float32Array(vertexCount * XYZ_STRIDE);
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    const lon = coordinates[vertex * LON_LAT_STRIDE] / BORDER_STEPS_PER_DEGREE;
    const lat = coordinates[vertex * LON_LAT_STRIDE + 1] / BORDER_STEPS_PER_DEGREE;
    segments.set(getLatLonVector(lat, lon), vertex * XYZ_STRIDE);
  }
  return segments;
}
