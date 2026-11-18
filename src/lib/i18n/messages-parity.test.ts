import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { baseLocale, locales } from '@/paraglide/runtime';

function getMessages(locale: string): Record<string, string> {
  const file = path.resolve(import.meta.dirname, `../../../messages/${locale}.json`);
  const { $schema: _schema, ...messages } = JSON.parse(readFileSync(file, 'utf8'));
  return messages;
}

function getPlaceholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
}

const en = getMessages(baseLocale);
const TRANSLATIONS = locales
  .filter((locale) => locale !== baseLocale)
  .map((locale) => ({ locale, messages: getMessages(locale) }));

describe.each(TRANSLATIONS)('messages parity for $locale', ({ messages }) => {
  it('has the same key set as en', () => {
    expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort());
  });

  it.each(Object.keys(en))('uses the same placeholders for %s', (key) => {
    expect(getPlaceholders(messages[key] ?? '')).toEqual(getPlaceholders(en[key]!));
  });
});
