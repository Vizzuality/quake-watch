type LatLon = { lat: number; lon: number };
export type Vector3 = [number, number, number];

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const DEGREES_PER_RADIAN = 180 / Math.PI;

export function getFibonacciPoints(count: number): Float32Array {
  const points = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const y = 1 - ((i + 0.5) / count) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = i * GOLDEN_ANGLE;
    points[i * 3] = Math.cos(theta) * r;
    points[i * 3 + 1] = y;
    points[i * 3 + 2] = Math.sin(theta) * r;
  }
  return points;
}

export function getPointLatLon(x: number, y: number, z: number): LatLon {
  return {
    lat: Math.asin(y) * DEGREES_PER_RADIAN,
    lon: Math.atan2(x, z) * DEGREES_PER_RADIAN,
  };
}

export function getLatLonVector(lat: number, lon: number): Vector3 {
  const phi = lat / DEGREES_PER_RADIAN;
  const lambda = lon / DEGREES_PER_RADIAN;
  return [Math.cos(phi) * Math.sin(lambda), Math.sin(phi), Math.cos(phi) * Math.cos(lambda)];
}

export function getRotatedVector([x, y, z]: Vector3, lon: number, lat: number): Vector3 {
  const ca = Math.cos(lon);
  const sa = Math.sin(lon);
  const cb = Math.cos(lat);
  const sb = Math.sin(lat);
  const x1 = x * ca - z * sa;
  const z1 = x * sa + z * ca;
  return [x1, y * cb - z1 * sb, y * sb + z1 * cb];
}

const COAST_UNITS_PER_DEGREE = 10;

export function getCoastSegments(lines: readonly (readonly number[])[]): {
  position: Float32Array;
  other: Float32Array;
} {
  const segmentCount = lines.reduce((count, line) => count + Math.max(0, line.length / 2 - 1), 0);
  const position = new Float32Array(segmentCount * 6);
  const other = new Float32Array(segmentCount * 6);
  let offset = 0;
  for (const line of lines) {
    for (let point = 2; point < line.length; point += 2) {
      const from = getLatLonVector(
        line[point - 1] / COAST_UNITS_PER_DEGREE,
        line[point - 2] / COAST_UNITS_PER_DEGREE,
      );
      const to = getLatLonVector(
        line[point + 1] / COAST_UNITS_PER_DEGREE,
        line[point] / COAST_UNITS_PER_DEGREE,
      );
      position.set(from, offset);
      position.set(to, offset + 3);
      other.set(to, offset);
      other.set(from, offset + 3);
      offset += 6;
    }
  }
  return { position, other };
}

export async function getRetried<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch {
    return load();
  }
}
