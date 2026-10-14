import type { ReactNode } from 'react';

export type DetailRow = { key: string; label: string; value: ReactNode; explanation: ReactNode };

export function getRow<T>(value: T | null, build: (present: T) => DetailRow): DetailRow | null {
  return value === null ? null : build(value);
}
