import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { getAlternateLinks } from '@/lib/seo/alternate-links';
import { isSiteIndexable } from '@/lib/seo/indexing';
import { getSiteOpenGraphMeta } from '@/lib/seo/open-graph';
import { getPageTitle } from '@/lib/seo/page-title';
import { THEME_BOOT_SCRIPT } from '@/lib/theme/theme';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

import appCss from '../styles.css?url';

const favicon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpolyline points='0,10 4,10 5.5,6 7,15 8.5,2 10,17 11.5,7 13,12 14.5,9 16,10 20,10' fill='none' stroke='%23d02e9a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: ({ matches }) => {
    const leaf = matches.at(-1);
    const { canonical, alternates, isNoindex } = getAlternateLinks({
      pathname: leaf?.pathname ?? '/',
      search: leaf?.search ?? {},
    });
    const title = getPageTitle(matches);

    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { title },
        { name: 'description', content: m.app_description() },
        ...getSiteOpenGraphMeta({ title, url: canonical, locale: getLocale() }),
        ...(isNoindex || !isSiteIndexable() ? [{ name: 'robots', content: 'noindex,follow' }] : []),
      ],
      links: [
        { rel: 'stylesheet', href: appCss },
        { rel: 'icon', href: favicon },
        { rel: 'preconnect', href: 'https://www.seismicportal.eu', crossOrigin: 'anonymous' },
        { rel: 'preconnect', href: 'https://tiles.openfreemap.org', crossOrigin: 'anonymous' },
        { rel: 'dns-prefetch', href: 'https://earthquake.usgs.gov' },
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
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="font-sans">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
