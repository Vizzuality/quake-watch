import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';

import { ErrorState } from '@/containers/states/error';
import { NotFound } from '@/containers/states/not-found';
import { deLocalizeUrl, localizeUrl } from '@/paraglide/runtime';

import { routeTree } from './routeTree.gen';

export function getRouter() {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultErrorComponent: ErrorState,
    defaultNotFoundComponent: NotFound,
    rewrite: {
      input: ({ url }) => deLocalizeUrl(url),
      output: ({ url }) => localizeUrl(url),
    },
  });
  setupRouterSsrQueryIntegration({ router, queryClient, wrapQueryClient: false });

  return router;
}
