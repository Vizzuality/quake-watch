import { getMagnitudeSwatch } from '@/earthquakes/magnitude';

const SAMPLES = [4, 5, 6].map((magnitude) => ({
  magnitude,
  ...getMagnitudeSwatch(magnitude),
}));

export function MagnitudeLegend() {
  return (
    <div className="pointer-events-none absolute bottom-16 left-3 flex items-center gap-4 rounded-lg bg-ink/70 px-3 py-2 text-xs text-muted backdrop-blur sm:bottom-8">
      <span id="magnitude-legend-title">Magnitude</span>
      <ul aria-labelledby="magnitude-legend-title" className="flex items-center gap-4">
        {SAMPLES.map(({ magnitude, color, diameter }) => (
          <li key={magnitude} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="rounded-full"
              style={{
                width: diameter,
                height: diameter,
                backgroundColor: color,
                boxShadow: `0 0 8px ${color}`,
              }}
            />
            {`M${magnitude}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
