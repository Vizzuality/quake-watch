export const SERVER_DETAIL_TIMEOUT_MS = 4_000;
const SERVER_DETAIL_RETRY = 0;
const CLIENT_DETAIL_RETRY = 1;

export function getDetailRetry(isServerRuntime: boolean): number {
  return isServerRuntime ? SERVER_DETAIL_RETRY : CLIENT_DETAIL_RETRY;
}

export function getDetailSignal(signal: AbortSignal, isServerRuntime: boolean): AbortSignal {
  if (!isServerRuntime) return signal;
  return AbortSignal.any([signal, AbortSignal.timeout(SERVER_DETAIL_TIMEOUT_MS)]);
}
