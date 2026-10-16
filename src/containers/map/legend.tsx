import { MAGNITUDE_FILL_CLASS_NAMES } from '@/components/magnitude-classes';
import { useEarthquakeSearch } from '@/hooks/use-earthquake-search';
import {
  MAGNITUDE_CLASS_BREAKS,
  MAGNITUDE_CLASSES,
  MAGNITUDE_RADIUS_STOPS,
  getIsMagnitudeClassBelow,
  getMagnitudeClassMinimum,
  getMagnitudeRadius,
} from '@/lib/earthquakes/magnitude';
import type { MagnitudeClass } from '@/lib/earthquakes/magnitude';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

const SMALLEST_MAPPED_MAGNITUDE = MAGNITUDE_RADIUS_STOPS[0]![0];
const LEGEND_SCALE = 0.5;
const LEGEND_MIN_DIAMETER = 5;

function getClassLabel(magnitudeClass: MagnitudeClass): string {
  const minimum = getMagnitudeClassMinimum(magnitudeClass);
  if (minimum === null) return `<${MAGNITUDE_CLASS_BREAKS[0]}`;
  if (magnitudeClass === MAGNITUDE_CLASSES.at(-1)) return `${minimum}+`;
  return String(minimum);
}

const SAMPLES = MAGNITUDE_CLASSES.map((magnitudeClass) => ({
  magnitudeClass,
  label: getClassLabel(magnitudeClass),
  diameter: Math.max(
    LEGEND_MIN_DIAMETER,
    getMagnitudeRadius(getMagnitudeClassMinimum(magnitudeClass) ?? SMALLEST_MAPPED_MAGNITUDE) *
      2 *
      LEGEND_SCALE,
  ),
}));

export function MagnitudeLegend() {
  const { minmag } = useEarthquakeSearch();

  return (
    <div className="flex items-end gap-3 text-2xs text-muted">
      <span id="magnitude-legend-title" className="pb-px">
        {m.legend_title()}
      </span>
      <ul aria-labelledby="magnitude-legend-title" className="flex items-end gap-2.5 sm:gap-3">
        {SAMPLES.map(({ magnitudeClass, label, diameter }) => (
          <li key={magnitudeClass} className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className={cn(
                'rounded-full ring-1 ring-fg/50',
                MAGNITUDE_FILL_CLASS_NAMES[magnitudeClass],
                getIsMagnitudeClassBelow(magnitudeClass, minmag) && 'opacity-30',
              )}
              style={{ width: diameter, height: diameter }}
            />
            <span className="font-mono tabular-nums">{`M${label}`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
