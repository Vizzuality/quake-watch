import { getPulse, getPulseLengthSeconds } from './wave';

export type PulseRaster = {
  width: number;
  height: number;
  pixels: Uint32Array;
  arrivals: Float32Array;
  intensities: Float32Array;
  colors: Uint8ClampedArray;
};

export type PulsePoint = { pixel: number; arrival: number; mmi: number; rgb: readonly number[] };

const BYTES_PER_PIXEL = 4;
const MAX_BYTE = 255;
export const SETTLED_ALPHA = 210;
export const PULSE_WHITE_MIX = 0.75;

export function getPulseRaster(
  width: number,
  height: number,
  points: readonly PulsePoint[],
): PulseRaster {
  return {
    width,
    height,
    pixels: Uint32Array.from(points, ({ pixel }) => pixel),
    arrivals: Float32Array.from(points, ({ arrival }) => arrival),
    intensities: Float32Array.from(points, ({ mmi }) => mmi),
    colors: Uint8ClampedArray.from(points.flatMap(({ rgb }) => rgb.slice(0, 3))),
  };
}

export function getSettledSeconds({ arrivals, intensities }: PulseRaster): number {
  let settledSeconds = 0;
  for (let point = 0; point < arrivals.length; point++) {
    settledSeconds = Math.max(
      settledSeconds,
      arrivals[point] + getPulseLengthSeconds(intensities[point]),
    );
  }
  return settledSeconds;
}

export function getPulseFrameBuffer({
  width,
  height,
}: PulseRaster): Uint8ClampedArray<ArrayBuffer> {
  return new Uint8ClampedArray(width * height * BYTES_PER_PIXEL);
}

export function paintPulseFrame(
  target: Uint8ClampedArray,
  raster: PulseRaster,
  seconds: number,
  settled: boolean,
) {
  const { pixels, arrivals, intensities, colors } = raster;
  for (let point = 0; point < pixels.length; point++) {
    const offset = pixels[point] * BYTES_PER_PIXEL;
    const arrived = settled || arrivals[point] <= seconds;
    if (!arrived) {
      target[offset + 3] = 0;
      continue;
    }
    const pulse = settled ? 0 : getPulse(seconds - arrivals[point], intensities[point]);
    const whiten = pulse * PULSE_WHITE_MIX;
    for (let channel = 0; channel < 3; channel++) {
      const base = colors[point * 3 + channel];
      target[offset + channel] = base + (MAX_BYTE - base) * whiten;
    }
    target[offset + 3] = SETTLED_ALPHA + (MAX_BYTE - SETTLED_ALPHA) * pulse;
  }
}
