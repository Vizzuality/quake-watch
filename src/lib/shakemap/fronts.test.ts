import { describe, expect, it } from 'vitest';

import { getDistanceKm } from '../earthquakes/distance';
import { getWaveFrontRing, getWaveFronts } from './fronts';
import { P_WAVE_KM_S, S_WAVE_KM_S, getWaveRadiusKm } from './wave';

const epicenter = { latitude: 10, longitude: -80 };

describe('getWaveFrontRing', () => {
  it('closes a geodesic circle at the given radius', () => {
    const ring = getWaveFrontRing(epicenter, 100);
    expect(ring[0]).toEqual(ring.at(-1));
    for (const [longitude, latitude] of ring) {
      expect(getDistanceKm(epicenter, { latitude, longitude })).toBeCloseTo(100, 0);
    }
  });
});

describe('getWaveFronts', () => {
  it('draws the P front ahead of the S front', () => {
    const { features } = getWaveFronts(epicenter, 10, 30, true);
    expect(features.map(({ properties }) => properties.wave)).toEqual(['p', 's']);
    const [p, s] = features.map(({ geometry }) => {
      const [longitude, latitude] = geometry.coordinates[0];
      return getDistanceKm(epicenter, { latitude, longitude });
    });
    expect(p).toBeCloseTo(getWaveRadiusKm(30, 10, P_WAVE_KM_S), 0);
    expect(s).toBeCloseTo(getWaveRadiusKm(30, 10, S_WAVE_KM_S), 0);
  });

  it('hides a front while it is still under the Depth', () => {
    const { features } = getWaveFronts(epicenter, 100, 20, true);
    expect(features.map(({ properties }) => properties.wave)).toEqual(['p']);
  });

  it('draws nothing once hidden', () => {
    expect(getWaveFronts(epicenter, 10, 30, false).features).toHaveLength(0);
  });
});
