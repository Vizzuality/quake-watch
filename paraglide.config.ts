import type { paraglideVitePlugin } from '@inlang/paraglide-js';

export const paraglideOptions: Parameters<typeof paraglideVitePlugin>[0] = {
  project: './project.inlang',
  outdir: './src/paraglide',
  outputStructure: 'message-modules',
  strategy: ['url', 'cookie', 'preferredLanguage', 'baseLocale'],
  urlPatterns: [
    {
      pattern: '/',
      localized: [
        ['en', '/en'],
        ['es', '/es'],
        ['pt', '/pt'],
      ],
    },
    {
      pattern: '/:path(.*)?',
      localized: [
        ['en', '/en/:path(.*)?'],
        ['es', '/es/:path(.*)?'],
        ['pt', '/pt/:path(.*)?'],
      ],
    },
  ],
  routeStrategies: [
    { match: '/sitemap.xml', exclude: true },
    { match: '/robots.txt', exclude: true },
  ],
};
