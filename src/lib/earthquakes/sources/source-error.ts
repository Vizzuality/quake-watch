import type { EarthquakeSource } from '../search-schema';
import { emscAdapter } from './emsc';
import { usgsAdapter } from './usgs';

const SOURCE_LABELS: Record<EarthquakeSource, string> = {
  emsc: emscAdapter.label,
  usgs: usgsAdapter.label,
};

export class EarthquakeSourceError extends Error {
  constructor(
    readonly source: EarthquakeSource,
    readonly status: number,
  ) {
    super(`${SOURCE_LABELS[source]} request failed with status ${status}`);
    this.name = 'EarthquakeSourceError';
  }
}
