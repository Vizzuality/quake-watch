import { describe, expect, it } from 'vitest';

import { getSitemap, getSitemapXml } from './sitemap';

const ORIGIN = 'https://quake-watch.up.railway.app';

function getUrlBlocks(xml: string): string[] {
  return xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
}

function getBlockFor(xml: string, loc: string): string | undefined {
  return getUrlBlocks(xml).find((block) => block.includes(`<loc>${loc}</loc>`));
}

describe('getSitemap', () => {
  it('declares the sitemap and xhtml namespaces', () => {
    const xml = getSitemap();

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    );
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
  });

  it('lists only the en and es homes, each with three hreflang alternates', () => {
    const xml = getSitemap();
    const alternates = [
      `<xhtml:link rel="alternate" hreflang="en" href="${ORIGIN}/en"/>`,
      `<xhtml:link rel="alternate" hreflang="es" href="${ORIGIN}/es"/>`,
      `<xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}/en"/>`,
    ];

    expect(getUrlBlocks(xml)).toHaveLength(2);
    for (const loc of [`${ORIGIN}/en`, `${ORIGIN}/es`]) {
      const block = getBlockFor(xml, loc);
      for (const alternate of alternates) expect(block).toContain(alternate);
    }
    expect(xml).not.toContain('<lastmod>');
  });
});

describe('getSitemapXml', () => {
  it('escapes XML special characters in urls', () => {
    const xml = getSitemapXml(['/a&b\'<c>"']);

    expect(xml).toContain('a&amp;b&apos;');
    expect(xml).not.toMatch(/&(?!amp;|apos;|lt;|gt;|quot;)/);
    expect(xml).not.toContain("'");
  });
});
