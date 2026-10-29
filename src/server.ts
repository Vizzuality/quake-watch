import handler from '@tanstack/react-start/server-entry';

import { getCompressedResponse } from '@/lib/http/compress-html';
import { paraglideMiddleware } from '@/paraglide/server';

export default {
  async fetch(req: Request): Promise<Response> {
    const response = await paraglideMiddleware(req, () => handler.fetch(req));
    return getCompressedResponse(req, response);
  },
};
