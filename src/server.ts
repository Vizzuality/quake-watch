import handler from '@tanstack/react-start/server-entry';

import { getCompressedResponse } from '@/lib/http/compress-html';
import { getLegacyRedirect } from '@/lib/http/legacy-redirect';
import { paraglideMiddleware } from '@/paraglide/server';

export default {
  async fetch(req: Request): Promise<Response> {
    const location = getLegacyRedirect(new URL(req.url));
    if (location) return new Response(null, { status: 308, headers: { location } });

    const response = await paraglideMiddleware(req, () => handler.fetch(req));
    return getCompressedResponse(req, response);
  },
};
