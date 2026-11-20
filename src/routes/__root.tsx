import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { getShareQuakeFromMatches } from '@/lib/earthquakes/details/share-earthquake';
import { getAlternateLinks } from '@/lib/seo/alternate-links';
import { isSiteIndexable } from '@/lib/seo/indexing';
import { getAlternateOgLocales, getSiteOpenGraphMeta } from '@/lib/seo/open-graph';
import { getPageTitle } from '@/lib/seo/page-title';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

import appCss from '../styles.css?url';

const THEME_COLOR = '#171a33';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: ({ matches }) => {
    const leaf = matches.at(-1);
    const { canonical, alternates, isNoindex } = getAlternateLinks({
      pathname: leaf?.pathname ?? '/',
      search: leaf?.search ?? {},
      quake: getShareQuakeFromMatches(matches),
    });
    const title = getPageTitle(matches);

    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: THEME_COLOR },
        { title },
        { name: 'description', content: m.app_description() },
        ...getSiteOpenGraphMeta({ title, url: canonical, locale: getLocale() }),
        ...(isNoindex || !isSiteIndexable() ? [{ name: 'robots', content: 'noindex,follow' }] : []),
      ],
      links: [
        { rel: 'stylesheet', href: appCss },
        { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
        { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
        { rel: 'canonical', href: canonical },
        ...alternates.map(({ hreflang, href }) => ({ rel: 'alternate', hrefLang: hreflang, href })),
      ],
    };
  },
  component: RootComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <Outlet />
      </QueryClientProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang={getLocale()}>
      <head>
        <HeadContent />
        {/* head() keeps one meta per property: https://github.com/TanStack/router/issues/5146 */}
        {getAlternateOgLocales(getLocale()).map((alternate) => (
          <meta key={alternate} property="og:locale:alternate" content={alternate} />
        ))}
      </head>
      <body className="font-sans">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
