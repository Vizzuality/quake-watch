import { getEarthquakeMeaning } from '@/lib/earthquakes/meaning';
import type { EarthquakeRow } from '@/lib/earthquakes/rows';
import { getEarthquakeMeaningLabel } from '@/lib/i18n/meaning-labels';
import { cn } from '@/lib/utils';
import type { Locale } from '@/paraglide/runtime';

function getMeaningClassName(isFelt: boolean): string {
  return isFelt ? 'text-fg' : 'text-muted';
}

export function EarthquakeMeaning({
  earthquake,
  place,
  locale,
  className,
}: {
  earthquake: EarthquakeRow;
  place: string | undefined;
  locale: Locale;
  className?: string;
}) {
  const meaning = getEarthquakeMeaning(earthquake);
  const isFelt =
    meaning.kind === 'felt-reach' || (meaning.kind === 'at-place' && meaning.key !== 'not_felt');

  return (
    <span className={cn(getMeaningClassName(isFelt), className)}>
      {getEarthquakeMeaningLabel(meaning, place, locale)}
    </span>
  );
}
