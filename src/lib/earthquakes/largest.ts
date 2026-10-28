import type { Earthquake } from './types';

export function getLargestEarthquakes(earthquakes: Earthquake[], count: number): Earthquake[] {
  return earthquakes
    .toSorted((a, b) => b.magnitude - a.magnitude || b.time - a.time)
    .slice(0, count);
}
