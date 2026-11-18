import { afterEach, describe, expect, it, vi } from 'vitest';

import { getReliefElevations } from './relief';
import { SLICE_LOOK } from './slice-line';
import { TERRARIUM_TILE_URL, TILE_SIZE } from './terrarium';

const SEA_FLOOR_PIXELS = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4).fill(0);
for (let offset = 0; offset < SEA_FLOOR_PIXELS.length; offset += 4) {
  SEA_FLOOR_PIXELS.set([120, 48, 0, 255], offset);
}

function decodeSeaFloor() {
  return Promise.resolve(SEA_FLOOR_PIXELS);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('relief elevations', () => {
  it('samples every line of the slice from the terrarium tiles it covers', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      expect(String(input).startsWith(`${TERRARIUM_TILE_URL}/6/`)).toBe(true);
      return new Response(new Blob(['png']));
    });
    vi.stubGlobal('fetch', fetchMock);

    const lines = await getReliefElevations(-17.56, 168.14, undefined, decodeSeaFloor);

    expect(lines).toHaveLength(SLICE_LOOK.backLines + 1);
    expect(lines[0]).toHaveLength(SLICE_LOOK.samples);
    expect(new Set(lines.flatMap((line) => Array.from(line)))).toEqual(new Set([-2000]));
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it('fails when a tile does not load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => new Response('missing', { status: 503 })),
    );

    await expect(getReliefElevations(0, 0, undefined, decodeSeaFloor)).rejects.toThrow('503');
  });
});
