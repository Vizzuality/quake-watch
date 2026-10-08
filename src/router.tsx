import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';

import { ErrorComponent } from '@/containers/errors/error-component';
import { NotFoundComponent } from '@/containers/errors/not-found-component';
import { deLocalizeUrl, localizeUrl } from '@/paraglide/runtime';

import { routeTree } from './routeTree.gen';

export function getRouter() {
  const queryClient = new QueryClient();

  return createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultErrorComponent: ErrorComponent,
    defaultNotFoundComponent: NotFoundComponent,
    rewrite: {
      input: ({ url }) => deLocalizeUrl(url),
      output: ({ url }) => localizeUrl(url),
    },
  });
}
