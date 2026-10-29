import { describe, expect, it } from 'vitest';

import { getCompressedResponse, getVaryWithAcceptEncoding, isGzipAccepted } from './compress-html';

const HTML = `<!doctype html><html><body><main>${'<a href="/en/earthquakes/emsc/1">x</a>'.repeat(50)}</main></body></html>`;

function getRequest(acceptEncoding: string | null, method = 'GET'): Request {
  const headers = new Headers();
  if (acceptEncoding !== null) headers.set('accept-encoding', acceptEncoding);
  return new Request('http://localhost/en', { method, headers });
}

function getHtmlResponse(headers: Record<string, string> = {}): Response {
  return new Response(HTML, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'content-length': '123', ...headers },
  });
}

async function getDecompressedText(response: Response): Promise<string> {
  if (!response.body) throw new Error('Response has no body');
  return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).text();
}

describe('isGzipAccepted', () => {
  it.each([
    'gzip',
    'gzip, deflate, br',
    'br;q=1.0, GZIP;q=0.5',
    'deflate, gzip;q=0.001',
    '*',
    'br, *;q=0.2',
  ])('accepts %s', (acceptEncoding) => {
    expect(isGzipAccepted(acceptEncoding)).toBe(true);
  });

  it.each([
    null,
    '',
    'identity',
    'br, deflate',
    'gzip;q=0',
    'gzip; q=0.000',
    'gzip;q=0, *',
    '*;q=0',
    'gzip;q=abc',
  ])('rejects %s', (acceptEncoding) => {
    expect(isGzipAccepted(acceptEncoding)).toBe(false);
  });
});

describe('getVaryWithAcceptEncoding', () => {
  it.each([
    [null, 'Accept-Encoding'],
    ['Accept-Language', 'Accept-Language, Accept-Encoding'],
    ['accept-encoding', 'accept-encoding'],
    ['Cookie, Accept-Encoding', 'Cookie, Accept-Encoding'],
    ['*', '*'],
  ])('turns %s into %s', (vary, expected) => {
    expect(getVaryWithAcceptEncoding(vary)).toBe(expected);
  });
});

describe('getCompressedResponse', () => {
  it('gzips HTML for a client that accepts gzip and round-trips to the original body', async () => {
    const original = getHtmlResponse({ vary: 'Accept-Language' });
    const compressed = getCompressedResponse(getRequest('gzip, deflate'), original);
    expect(compressed).not.toBe(original);
    expect(compressed.status).toBe(200);
    expect(compressed.headers.get('content-encoding')).toBe('gzip');
    expect(compressed.headers.get('vary')).toBe('Accept-Language, Accept-Encoding');
    expect(compressed.headers.has('content-length')).toBe(false);
    expect(compressed.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await getDecompressedText(compressed)).toBe(HTML);
  });

  it('keeps the status and status text of an error page', () => {
    const original = new Response(HTML, {
      status: 404,
      statusText: 'Not Found',
      headers: { 'content-type': 'text/html' },
    });
    const compressed = getCompressedResponse(getRequest('gzip'), original);
    expect(compressed.status).toBe(404);
    expect(compressed.statusText).toBe('Not Found');
    expect(compressed.headers.get('vary')).toBe('Accept-Encoding');
  });

  it.each([
    ['no accept-encoding', getRequest(null), getHtmlResponse()],
    ['gzip;q=0', getRequest('gzip;q=0'), getHtmlResponse()],
    ['a HEAD request', getRequest('gzip', 'HEAD'), getHtmlResponse()],
    [
      'plain text',
      getRequest('gzip'),
      new Response('User-agent: *', { headers: { 'content-type': 'text/plain' } }),
    ],
    [
      'XML',
      getRequest('gzip'),
      new Response('<urlset/>', { headers: { 'content-type': 'application/xml' } }),
    ],
    ['a missing content-type', getRequest('gzip'), new Response(new Uint8Array([1, 2, 3]))],
    ['an encoded body', getRequest('gzip'), getHtmlResponse({ 'content-encoding': 'br' })],
    [
      'a 304',
      getRequest('gzip'),
      new Response(null, { status: 304, headers: { 'content-type': 'text/html' } }),
    ],
    [
      'an empty body',
      getRequest('gzip'),
      new Response(null, { status: 200, headers: { 'content-type': 'text/html' } }),
    ],
  ])('passes %s through unchanged', (_, request, response) => {
    expect(getCompressedResponse(request, response)).toBe(response);
  });
});
