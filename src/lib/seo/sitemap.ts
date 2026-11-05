import { getAlternateLinks } from './alternate-links';

const PATHNAMES = ['/'];

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function getEscapedXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char);
}

function getPathnameXml(pathname: string): string {
  const { alternates } = getAlternateLinks({ pathname, search: {} });
  const alternatesXml = alternates
    .map(
      ({ hreflang, href }) =>
        `<xhtml:link rel="alternate" hreflang="${hreflang}" href="${getEscapedXml(href)}"/>`,
    )
    .join('');
  return alternates
    .filter(({ hreflang }) => hreflang !== 'x-default')
    .map(({ href }) => `<url><loc>${getEscapedXml(href)}</loc>${alternatesXml}</url>`)
    .join('\n');
}

export function getSitemapXml(pathnames: string[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...pathnames.map(getPathnameXml),
    '</urlset>',
    '',
  ].join('\n');
}

export function getSitemap(): string {
  return getSitemapXml(PATHNAMES);
}
