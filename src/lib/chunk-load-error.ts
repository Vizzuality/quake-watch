const CHUNK_LOAD_ERROR =
  /dynamically imported module|module script failed|Loading chunk|Unable to preload/i;

export function isChunkLoadError(error: Error): boolean {
  return CHUNK_LOAD_ERROR.test(error.message);
}
