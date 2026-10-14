import { describe, expect, it, vi } from 'vitest';

import { terrariumTileQueryOptions } from './terrarium-query-options';

const tile = { z: 7, x: 62, y: 48 };

function stubImageDecoding(pixels: Uint8ClampedArray) {
  const close = vi.fn<() => void>();
  const drawImage = vi.fn<() => void>();
  const createImageBitmap = vi.fn<(blob: Blob, options: ImageBitmapOptions) => Promise<unknown>>(
    async () => ({ width: 1, height: 1, close }),
  );
  vi.stubGlobal('createImageBitmap', createImageBitmap);
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      getContext() {
        return {
          drawImage,
          getImageData: () => ({ width: 1, height: 1, data: pixels }),
        };
      }
    },
  );
  return { close, drawImage, createImageBitmap };
}

async function getQueryResult(signal = new AbortController().signal) {
  const { queryFn } = terrariumTileQueryOptions(tile);
  return (queryFn as (context: { signal: AbortSignal }) => Promise<unknown>)({ signal });
}

describe('terrariumTileQueryOptions', () => {
  it('keys the query by tile', () => {
    expect(terrariumTileQueryOptions(tile).queryKey).toEqual(['terrarium-tile', 7, 62, 48]);
  });

  it('never goes stale since tiles are static', () => {
    expect(terrariumTileQueryOptions(tile).staleTime).toBe(Infinity);
  });

  it('decodes the tile PNG into raw pixels', async () => {
    const fetchMock = vi.fn<(input: string) => Promise<Response>>(
      async () => new Response(new Blob(['png'])),
    );
    vi.stubGlobal('fetch', fetchMock);
    const pixels = new Uint8ClampedArray([128, 0, 0, 255]);
    const { close } = stubImageDecoding(pixels);
    await expect(getQueryResult()).resolves.toEqual({ tile, width: 1, height: 1, data: pixels });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/7/62/48.png',
    );
    expect(close).toHaveBeenCalled();
  });

  it('forwards the abort signal and decodes without color management', async () => {
    const fetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(
      async () => new Response(new Blob(['png'])),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { createImageBitmap } = stubImageDecoding(new Uint8ClampedArray(4));
    const { signal } = new AbortController();
    await getQueryResult(signal);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual({ signal });
    expect(createImageBitmap.mock.calls[0]?.[1]).toEqual({
      colorSpaceConversion: 'none',
      premultiplyAlpha: 'none',
    });
  });

  it('releases the bitmap when decoding fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Blob(['png']))),
    );
    const { close } = stubImageDecoding(new Uint8ClampedArray(4));
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        getContext() {
          return null;
        }
      },
    );
    await expect(getQueryResult()).rejects.toThrow('2D');
    expect(close).toHaveBeenCalled();
  });

  it('fails on an HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 403 })),
    );
    await expect(getQueryResult()).rejects.toThrow('403');
  });

  it('fails without a 2D context', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Blob(['png']))),
    );
    stubImageDecoding(new Uint8ClampedArray(4));
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        getContext() {
          return null;
        }
      },
    );
    await expect(getQueryResult()).rejects.toThrow('2D');
  });
});
