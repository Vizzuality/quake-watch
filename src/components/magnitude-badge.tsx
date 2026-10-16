import { MAGNITUDE_BADGE_CLASS_NAMES } from '@/components/magnitude-classes';
import { getMagnitudeClass } from '@/lib/earthquakes/magnitude';
import { cn } from '@/lib/utils';

export function MagnitudeBadge({
  magnitude,
  className,
}: {
  magnitude: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-block min-w-11 rounded-xs px-1.5 text-center font-mono font-semibold tabular-nums',
        MAGNITUDE_BADGE_CLASS_NAMES[getMagnitudeClass(magnitude)],
        className,
      )}
    >
      {magnitude.toFixed(1)}
    </span>
  );
}
