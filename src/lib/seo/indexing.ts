export function isSiteIndexableFromEnv(raw: string | undefined): boolean {
  return raw === 'true';
}

export function isSiteIndexable(): boolean {
  return isSiteIndexableFromEnv(import.meta.env.VITE_SITE_INDEXABLE);
}
