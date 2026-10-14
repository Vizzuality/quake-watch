import { describe, expect, it } from 'vitest';

import { getZipEntries } from './zip';

type FixtureEntry = {
  name: string;
  data: Uint8Array;
  method?: 0 | 8 | 12;
  flags?: number;
  isCompressed?: boolean;
};

const encoder = new TextEncoder();

async function getDeflated(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function getBytes(size: number, write: (view: DataView) => void): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size);
  write(new DataView(bytes.buffer));
  return bytes;
}

function getConcatenated(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function getZip(entries: FixtureEntry[], comment = ''): Promise<ArrayBuffer> {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const { name, data, method = 0, flags = 0, isCompressed = method === 8 } of entries) {
    const nameBytes = encoder.encode(name);
    const payload = isCompressed ? await getDeflated(new Uint8Array(data)) : data;
    const local = getConcatenated([
      getBytes(30, (view) => {
        view.setUint32(0, 0x04034b50, true);
        view.setUint16(6, flags, true);
        view.setUint16(8, method, true);
        view.setUint32(18, payload.length, true);
        view.setUint32(22, data.length, true);
        view.setUint16(26, nameBytes.length, true);
        view.setUint16(28, 3, true);
      }),
      nameBytes,
      new Uint8Array(3),
      payload,
    ]);
    centrals.push(
      getConcatenated([
        getBytes(46, (view) => {
          view.setUint32(0, 0x02014b50, true);
          view.setUint16(8, flags, true);
          view.setUint16(10, method, true);
          view.setUint32(20, payload.length, true);
          view.setUint32(24, data.length, true);
          view.setUint16(28, nameBytes.length, true);
          view.setUint16(30, 2, true);
          view.setUint16(32, 4, true);
          view.setUint32(42, offset, true);
        }),
        nameBytes,
        new Uint8Array(2),
        new Uint8Array(4),
      ]),
    );
    locals.push(local);
    offset += local.length;
  }
  const central = getConcatenated(centrals);
  const commentBytes = encoder.encode(comment);
  const eocd = getConcatenated([
    getBytes(22, (view) => {
      view.setUint32(0, 0x06054b50, true);
      view.setUint16(8, entries.length, true);
      view.setUint16(10, entries.length, true);
      view.setUint32(12, central.length, true);
      view.setUint32(16, offset, true);
      view.setUint16(20, commentBytes.length, true);
    }),
    commentBytes,
  ]);
  return getConcatenated([...locals, central, eocd]).buffer;
}

function getText(bytes: Uint8Array | undefined): string {
  return new TextDecoder().decode(bytes);
}

describe('getZipEntries', () => {
  it('reads stored and deflated entries', async () => {
    const csv = 'a,b,c\n'.repeat(200);
    const zip = await getZip([
      { name: 'stored.txt', data: encoder.encode('hello'), method: 0 },
      { name: '20261009_0000264.csv', data: encoder.encode(csv), method: 8 },
    ]);
    const entries = await getZipEntries(zip);
    expect(getText(entries.get('stored.txt'))).toBe('hello');
    expect(getText(entries.get('20261009_0000264.csv'))).toBe(csv);
  });

  it('keeps extra entries by name, skips folders, other methods and encrypted entries', async () => {
    const zip = await getZip([
      { name: 'events.csv', data: encoder.encode('#unid\n1') },
      { name: 'LICENCE.txt', data: encoder.encode('CC BY 4.0'), method: 8 },
      { name: 'folder/', data: new Uint8Array() },
      { name: 'bzip.bin', data: encoder.encode('x'), method: 12, isCompressed: false },
      { name: 'secret.csv', data: encoder.encode('x'), flags: 1 },
    ]);
    const entries = await getZipEntries(zip);
    expect(Array.from(entries.keys())).toEqual(['events.csv', 'LICENCE.txt']);
    expect(getText(entries.get('LICENCE.txt'))).toBe('CC BY 4.0');
  });

  it('finds the end record behind a trailing archive comment', async () => {
    const zip = await getZip([{ name: 'a.txt', data: encoder.encode('a') }], 'made by test');
    expect(getText((await getZipEntries(zip)).get('a.txt'))).toBe('a');
  });

  it('returns an empty map for an empty archive', async () => {
    expect((await getZipEntries(await getZip([]))).size).toBe(0);
  });

  it('rejects data that is not a ZIP archive', async () => {
    await expect(
      getZipEntries(encoder.encode('not a zip at all, just text').buffer),
    ).rejects.toThrow('Not a ZIP archive');
  });

  it('rejects an archive whose directory points at garbage', async () => {
    const zip = new Uint8Array(await getZip([{ name: 'a.txt', data: encoder.encode('a') }]));
    const eocd = zip.length - 22;
    new DataView(zip.buffer).setUint32(eocd + 16, 0, true);
    zip[0] = 0;
    await expect(getZipEntries(zip.buffer)).rejects.toThrow('Corrupt ZIP archive');
  });

  it('rejects a directory entry that points at garbage', async () => {
    const zip = new Uint8Array(await getZip([{ name: 'a.txt', data: encoder.encode('a') }]));
    const eocd = zip.length - 22;
    const directoryStart = new DataView(zip.buffer).getUint32(eocd + 16, true);
    zip[directoryStart] = 0;
    await expect(getZipEntries(zip.buffer)).rejects.toThrow('Corrupt ZIP archive');
  });

  it('rejects an entry whose size runs past the end of the archive', async () => {
    const zip = new Uint8Array(await getZip([{ name: 'a.txt', data: encoder.encode('a') }]));
    const view = new DataView(zip.buffer);
    const directoryStart = view.getUint32(zip.length - 22 + 16, true);
    view.setUint32(directoryStart + 20, zip.length, true);
    await expect(getZipEntries(zip.buffer)).rejects.toThrow('Corrupt ZIP archive');
  });
});
