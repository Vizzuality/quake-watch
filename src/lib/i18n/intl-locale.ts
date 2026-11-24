const INTL_LOCALES: Record<string, string> = { pt: 'pt-PT' };

export function getIntlLocale(locale: string): string {
  return INTL_LOCALES[locale] ?? locale;
}

export function getCachedFormat<T>(cache: Map<string, T>, key: string, create: () => T): T {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const format = create();
  cache.set(key, format);
  return format;
}
