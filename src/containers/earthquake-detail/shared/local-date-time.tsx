import { getLocalDateTimeLabel } from '@/lib/format';
import { getLocalDateTimePlaceholder } from '@/lib/time-placeholder';
import type { Locale } from '@/paraglide/runtime';

import { ClientOnlyText } from './client-only-text';

export function LocalDateTime({ time, locale }: { time: number; locale: Locale }) {
  return (
    <ClientOnlyText placeholder={getLocalDateTimePlaceholder(time, locale)}>
      <time dateTime={new Date(time).toISOString()}>{getLocalDateTimeLabel(time, locale)}</time>
    </ClientOnlyText>
  );
}
