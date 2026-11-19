import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { getBinaryAsset } from './binary-asset';

const PAYLOAD = new Uint8Array([67, 82, 83, 49, 1, 2, 3]);

describe('binary asset', () => {
  it('inflates a gzip-compressed asset', async () => {
    const response = new Response(gzipSync(PAYLOAD));

    expect(Array.from(await getBinaryAsset(response))).toEqual(Array.from(PAYLOAD));
  });

  it('passes through an asset the server already decompressed', async () => {
    expect(Array.from(await getBinaryAsset(new Response(PAYLOAD)))).toEqual(Array.from(PAYLOAD));
  });

  it('fails on an HTTP error', async () => {
    await expect(getBinaryAsset(new Response('nope', { status: 404 }))).rejects.toThrow('404');
  });
});
