import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function getMessages(locale: string): Record<string, string> {
  const file = path.resolve(import.meta.dirname, `../../../messages/${locale}.json`);
  const { $schema: _schema, ...messages } = JSON.parse(readFileSync(file, 'utf8'));
  return messages;
}

function getPlaceholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
}

const en = getMessages('en');
const es = getMessages('es');

describe('messages parity', () => {
  it('has identical key sets in en and es', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });

  it.each(Object.keys(en))('uses the same placeholders for %s', (key) => {
    expect(getPlaceholders(es[key] ?? '')).toEqual(getPlaceholders(en[key]!));
  });
});
