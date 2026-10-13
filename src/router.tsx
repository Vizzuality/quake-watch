import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';

import { deLocalizeUrl, localizeUrl } from '@/paraglide/runtime';

import { routeTree } from './routeTree.gen';

export function getRouter() {
  const queryClient = new QueryClient();

  return createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    rewrite: {
      input: ({ url }) => deLocalizeUrl(url),
      output: ({ url }) => localizeUrl(url),
    },
  });
}
