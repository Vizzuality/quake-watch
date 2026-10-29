const BODILESS_STATUSES = new Set([204, 304]);

function getQuality(params: string[]): number {
  const quality = params.find((param) => param.trim().toLowerCase().startsWith('q='));
  if (!quality) return 1;
  const value = Number(quality.trim().slice(2));
  return Number.isNaN(value) ? 0 : value;
}

function getCodingQualities(acceptEncoding: string): Map<string, number> {
  const qualities = new Map<string, number>();
  for (const entry of acceptEncoding.split(',')) {
    const [coding, ...params] = entry.split(';');
    const name = coding.trim().toLowerCase();
    if (name) qualities.set(name, getQuality(params));
  }
  return qualities;
}

export function isGzipAccepted(acceptEncoding: string | null): boolean {
  if (!acceptEncoding) return false;
  const qualities = getCodingQualities(acceptEncoding);
  const quality = qualities.get('gzip') ?? qualities.get('*') ?? 0;
  return quality > 0;
}

export function getVaryWithAcceptEncoding(vary: string | null): string {
  if (!vary) return 'Accept-Encoding';
  const fields = vary.split(',').map((field) => field.trim().toLowerCase());
  if (fields.includes('*') || fields.includes('accept-encoding')) return vary;
  return `${vary}, Accept-Encoding`;
}

function isCompressible(request: Request, response: Response): boolean {
  return (
    request.method !== 'HEAD' &&
    !BODILESS_STATUSES.has(response.status) &&
    !response.headers.has('content-encoding') &&
    (response.headers.get('content-type') ?? '').toLowerCase().startsWith('text/html') &&
    isGzipAccepted(request.headers.get('accept-encoding'))
  );
}

export function getCompressedResponse(request: Request, response: Response): Response {
  const { body } = response;
  if (!body || !isCompressible(request, response)) return response;
  const headers = new Headers(response.headers);
  headers.set('content-encoding', 'gzip');
  headers.set('vary', getVaryWithAcceptEncoding(headers.get('vary')));
  headers.delete('content-length');
  return new Response(body.pipeThrough(new CompressionStream('gzip')), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
