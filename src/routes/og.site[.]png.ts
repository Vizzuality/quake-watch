import { createFileRoute } from '@tanstack/react-router';
import { createElement } from 'react';

import { getLocale } from '@/paraglide/runtime';
import { getShareCardPng, getShareCardResponse } from '@/server/og/render-share-card';
import { SiteShareCard } from '@/server/og/share-card';

const MAX_AGE_SECONDS = 86_400;

export const Route = createFileRoute('/og/site.png')({
  server: {
    handlers: {
      GET: async () => {
        const card = createElement(SiteShareCard, {
          locale: getLocale(),
        });
        return getShareCardResponse(await getShareCardPng(card), MAX_AGE_SECONDS);
      },
    },
  },
});
