import { Resvg } from '@resvg/resvg-js';
import type { ReactNode } from 'react';
import satori from 'satori';

import { SHARE_IMAGE_HEIGHT, SHARE_IMAGE_WIDTH } from '@/lib/seo/open-graph';

import { getShareCardFonts } from './fonts';

export async function getShareCardPng(card: ReactNode): Promise<Uint8Array<ArrayBuffer>> {
  const svg = await satori(card, {
    width: SHARE_IMAGE_WIDTH,
    height: SHARE_IMAGE_HEIGHT,
    fonts: getShareCardFonts(),
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: SHARE_IMAGE_WIDTH } })
    .render()
    .asPng();
  return new Uint8Array(png);
}

export function getShareCardResponse(
  png: Uint8Array<ArrayBuffer>,
  maxAgeSeconds: number,
): Response {
  return new Response(png, {
    headers: {
      'content-type': 'image/png',
      'cache-control': `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}`,
    },
  });
}
