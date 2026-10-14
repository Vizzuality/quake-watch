import { queryOptions } from '@tanstack/react-query';

import type { TilePixels } from './scene';
import { getTerrariumTileUrl, type TileCoord } from './terrarium';

async function getTerrariumTilePixels(tile: TileCoord, signal: AbortSignal): Promise<TilePixels> {
  const response = await fetch(getTerrariumTileUrl(tile), { signal });
  if (!response.ok) {
    throw new Error(`Terrarium tile ${tile.z}/${tile.x}/${tile.y} failed with ${response.status}`);
  }
  // Raw RGB encodes elevation: https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap
  const bitmap = await createImageBitmap(await response.blob(), {
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none',
  });
  try {
    const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
    if (!context) throw new Error('No 2D canvas context to decode Terrarium tiles');
    context.drawImage(bitmap, 0, 0);
    const { width, height, data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    return { tile, width, height, data };
  } finally {
    bitmap.close();
  }
}

export function terrariumTileQueryOptions(tile: TileCoord) {
  return queryOptions({
    queryKey: ['terrarium-tile', tile.z, tile.x, tile.y] as const,
    queryFn: ({ signal }) => getTerrariumTilePixels(tile, signal),
    staleTime: Infinity,
  });
}
