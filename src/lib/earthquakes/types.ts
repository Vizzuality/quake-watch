import type { EarthquakeSource } from './search-schema';

export type Earthquake = {
  id: string;
  source: EarthquakeSource;
  magnitude: number;
  magnitudeType: string | null;
  place: string | null;
  time: number;
  depthKm: number;
  longitude: number;
  latitude: number;
  url: string;
};
