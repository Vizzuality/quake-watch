import { MAGNITUDE_FILL_CLASS_NAMES } from '@/components/magnitude-classes';
import {
  MAGNITUDE_CLASS_BREAKS,
  MAGNITUDE_CLASSES,
  MAGNITUDE_RADIUS_STOPS,
  getMagnitudeClassMinimum,
  getMagnitudeRadius,
} from '@/lib/earthquakes/magnitude';
import type { MagnitudeClass } from '@/lib/earthquakes/magnitude';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

const SMALLEST_MAPPED_MAGNITUDE = MAGNITUDE_RADIUS_STOPS[0]![0];

function getClassLabel(magnitudeClass: MagnitudeClass): string {
  const minimum = getMagnitudeClassMinimum(magnitudeClass);
  if (minimum === null) return `<${MAGNITUDE_CLASS_BREAKS[0]}`;
  if (magnitudeClass === MAGNITUDE_CLASSES.at(-1)) return `${minimum}+`;
  return String(minimum);
}

const SAMPLES = MAGNITUDE_CLASSES.map((magnitudeClass) => ({
  magnitudeClass,
  label: getClassLabel(magnitudeClass),
  diameter:
    getMagnitudeRadius(getMagnitudeClassMinimum(magnitudeClass) ?? SMALLEST_MAPPED_MAGNITUDE) * 2,
}));

export function MagnitudeLegend() {
  return (
    <div className="pointer-events-none absolute bottom-[calc(13.5rem+env(safe-area-inset-bottom))] left-3 flex items-end gap-3 rounded-md bg-canvas/85 px-3 py-2 text-2xs text-muted backdrop-blur sm:bottom-48">
      <span id="magnitude-legend-title" className="self-center">
        {m.legend_title()}
      </span>
      <ul aria-labelledby="magnitude-legend-title" className="flex items-end gap-2.5">
        {SAMPLES.map(({ magnitudeClass, label, diameter }) => (
          <li key={magnitudeClass} className="flex flex-col items-center gap-1">
            <span
              aria-hidden="true"
              className={cn(
                'rounded-full ring-1 ring-fg/50',
                MAGNITUDE_FILL_CLASS_NAMES[magnitudeClass],
              )}
              style={{ width: diameter, height: diameter }}
            />
            <span className="font-mono tabular-nums">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
