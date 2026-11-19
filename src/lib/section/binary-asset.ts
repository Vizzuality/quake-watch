const GZIP_MAGIC = [0x1f, 0x8b];

function isGzip(bytes: Uint8Array): boolean {
  return bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1];
}

export async function getBinaryAsset(response: Response): Promise<Uint8Array> {
  if (!response.ok) throw new Error(`Section asset failed: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!isGzip(bytes)) return bytes;
  const inflated = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(inflated).arrayBuffer());
}
