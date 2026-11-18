import { getSliceLines } from './slice-line';
import {
  RELIEF_ZOOM,
  TILE_SIZE,
  type TileElevations,
  getElevationSampler,
  getTerrariumElevations,
  getTileKeys,
  getTileUrl,
} from './terrarium';

export type TileDecoder = (blob: Blob) => Promise<Uint8ClampedArray>;

async function getCanvasPixels(blob: Blob): Promise<Uint8ClampedArray> {
  const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
  const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('No 2D canvas to decode relief tiles');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return context.getImageData(0, 0, TILE_SIZE, TILE_SIZE).data;
}

async function getTile(
  key: string,
  signal: AbortSignal | undefined,
  decode: TileDecoder,
): Promise<[string, Float32Array]> {
  const response = await fetch(getTileUrl(key), { signal });
  if (!response.ok) throw new Error(`Relief tile ${key} failed: ${response.status}`);
  return [key, getTerrariumElevations(await decode(await response.blob()))];
}

export async function getReliefElevations(
  lat: number,
  lon: number,
  signal?: AbortSignal,
  decode: TileDecoder = getCanvasPixels,
): Promise<Float32Array[]> {
  const lines = getSliceLines(lat, lon);
  const keys = getTileKeys(lines.flat(), RELIEF_ZOOM);
  const tiles: TileElevations = new Map(
    await Promise.all(keys.map((key) => getTile(key, signal, decode))),
  );
  const sample = getElevationSampler(tiles, RELIEF_ZOOM);
  return lines.map((line) =>
    Float32Array.from(line, ([pointLon, pointLat]) => sample(pointLon, pointLat)),
  );
}
