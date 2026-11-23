import { shouldRedirect } from '@/paraglide/runtime';

const SERVER_FN_PREFIX = '/_serverFn/';
const REDIRECTABLE_METHODS = new Set(['GET', 'HEAD']);
const LOCALE_NEGOTIATION_VARY = 'Accept-Language, Cookie';

function getPathWithSearch(url: URL): string {
  return `${url.pathname}${url.search}`;
}

function getTrailingSlashRedirect(url: URL): Response | null {
  if (url.pathname === '/' || !url.pathname.endsWith('/')) return null;
  const pathname = url.pathname.replace(/^\/+/, '/').replace(/\/+$/, '') || '/';
  const location = `${pathname}${url.search}`;
  return new Response(null, { status: 308, headers: { location } });
}

async function getLocaleRedirect(request: Request): Promise<Response | null> {
  const decision = await shouldRedirect({ request });
  if (!decision.shouldRedirect || !decision.redirectUrl) return null;
  return new Response(null, {
    status: 307,
    headers: { location: getPathWithSearch(decision.redirectUrl), vary: LOCALE_NEGOTIATION_VARY },
  });
}

export async function getCanonicalRedirect(request: Request): Promise<Response | null> {
  if (!REDIRECTABLE_METHODS.has(request.method)) return null;
  const url = new URL(request.url);
  if (url.pathname.startsWith(SERVER_FN_PREFIX)) return null;
  return getTrailingSlashRedirect(url) ?? getLocaleRedirect(request);
}
