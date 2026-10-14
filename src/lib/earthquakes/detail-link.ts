import type { EarthquakeSource } from './search-schema';
import type { Earthquake } from './types';

const DETAIL_ROUTES = {
  usgs: '/earthquakes/usgs/$earthquakeId',
  emsc: '/earthquakes/emsc/$earthquakeId',
} as const satisfies Record<EarthquakeSource, string>;

export function getEarthquakeDetailLinkOptions({ id, source }: Pick<Earthquake, 'id' | 'source'>) {
  return { to: DETAIL_ROUTES[source], params: { earthquakeId: id } };
}
