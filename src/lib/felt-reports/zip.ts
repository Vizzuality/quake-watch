const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN_BYTES = 22;
const MAX_COMMENT_BYTES = 0xffff;
const CENTRAL_HEADER_BYTES = 46;
const LOCAL_HEADER_BYTES = 30;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;
const FLAG_ENCRYPTED = 1;

async function getInflated(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function getEndOfCentralDirectory(view: DataView): number {
  const lowest = Math.max(0, view.byteLength - EOCD_MIN_BYTES - MAX_COMMENT_BYTES);
  for (let offset = view.byteLength - EOCD_MIN_BYTES; offset >= lowest; offset--) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset;
  }
  throw new Error('Not a ZIP archive');
}

export async function getZipEntries(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();
  const eocd = getEndOfCentralDirectory(view);
  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries = new Map<string, Uint8Array>();

  for (let index = 0; index < entryCount; index++) {
    if (view.getUint32(offset, true) !== CENTRAL_SIGNATURE) throw new Error('Corrupt ZIP archive');
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const nameStart = offset + CENTRAL_HEADER_BYTES;
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    offset = nameStart + nameLength + extraLength + commentLength;

    const isSupported = method === METHOD_STORED || method === METHOD_DEFLATE;
    if (flags & FLAG_ENCRYPTED || !isSupported || name.endsWith('/')) continue;
    if (view.getUint32(localOffset, true) !== LOCAL_SIGNATURE)
      throw new Error('Corrupt ZIP archive');
    const dataStart =
      localOffset +
      LOCAL_HEADER_BYTES +
      view.getUint16(localOffset + 26, true) +
      view.getUint16(localOffset + 28, true);
    if (dataStart + compressedSize > bytes.length) throw new Error('Corrupt ZIP archive');
    const data = bytes.slice(dataStart, dataStart + compressedSize);
    entries.set(name, method === METHOD_STORED ? data : await getInflated(data));
  }
  return entries;
}
