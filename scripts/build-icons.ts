import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { Resvg } from '@resvg/resvg-js';

const PUBLIC_DIR = path.resolve(import.meta.dirname, '../public');
const ROUNDED_CORNERS = ' rx="7"';
const ICO_HEADER_BYTES = 6;
const ICO_ENTRY_BYTES = 16;
const FAVICON_SIZE = 32;

function getPng(svg: string, size: number): Buffer {
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
}

function getIco(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(ICO_HEADER_BYTES + ICO_ENTRY_BYTES);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(size, 6);
  header.writeUInt8(size, 7);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(header.length, 18);
  return Buffer.concat([header, png]);
}

const icon = readFileSync(path.join(PUBLIC_DIR, 'icon.svg'), 'utf8');
if (!icon.includes(ROUNDED_CORNERS)) throw new Error(`icon.svg has no${ROUNDED_CORNERS} tile`);
const fullBleedIcon = icon.replace(ROUNDED_CORNERS, '');

writeFileSync(
  path.join(PUBLIC_DIR, 'favicon.ico'),
  getIco(getPng(icon, FAVICON_SIZE), FAVICON_SIZE),
);
writeFileSync(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), getPng(fullBleedIcon, 180));
writeFileSync(path.join(PUBLIC_DIR, 'icon-192.png'), getPng(icon, 192));
writeFileSync(path.join(PUBLIC_DIR, 'icon-512.png'), getPng(icon, 512));
