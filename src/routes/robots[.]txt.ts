import { createFileRoute } from '@tanstack/react-router';

import { getSiteUrl } from '@/lib/seo/site-url';

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () =>
        new Response(`User-agent: *\nAllow: /\n\nSitemap: ${getSiteUrl()}/sitemap.xml\n`, {
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'public, max-age=86400',
          },
        }),
    },
  },
});
