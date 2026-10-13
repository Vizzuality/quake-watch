import { getMagnitudeColor } from '@/lib/earthquakes/magnitude';
import { cn } from '@/lib/utils';

const LIGHT_TEXT_MIN_MAGNITUDE = 7;

function getMagnitudeTextClassName(magnitude: number): string {
  return magnitude >= LIGHT_TEXT_MIN_MAGNITUDE ? 'text-white' : 'text-ink';
}

export function MagnitudeBadge({ magnitude }: { magnitude: number }) {
  return (
    <span
      className={cn(
        'inline-block min-w-10 rounded px-1.5 text-center font-semibold tabular-nums',
        getMagnitudeTextClassName(magnitude),
      )}
      style={{ backgroundColor: getMagnitudeColor(magnitude) }}
    >
      {magnitude.toFixed(1)}
    </span>
  );
}
