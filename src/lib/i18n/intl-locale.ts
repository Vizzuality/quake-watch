const INTL_LOCALES: Record<string, string> = { pt: 'pt-PT' };

export function getIntlLocale(locale: string): string {
  return INTL_LOCALES[locale] ?? locale;
}
