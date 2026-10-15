import { describe, expect, it } from 'vitest';

import { FELT_INTENSITY, getFeltReachKm, getIntensity } from '@/lib/earthquakes/intensity';
import type { Earthquake } from '@/lib/earthquakes/types';
import { P_WAVE_KM_S, S_WAVE_KM_S, getArrivalSeconds, getWaveRadiusKm } from '@/lib/shakemap/wave';

import {
  WAVE_FRONT_STYLES,
  WAVE_INSTANCE_STRIDE,
  WAVE_RAMP,
  getMercatorX,
  getMercatorY,
  getPlaybackSpanMs,
  getFloat32Split,
  getRgb,
  getTranslatedMatrix,
  getWaveColor,
  getWaveFade,
  getWaveInstances,
  getWaveIntensity,
  getWaveFrontKm,
  getWaveOpacity,
  getWaveSeconds,
  getWaveSpanMs,
  getWaveStyle,
  getWorldCopies,
} from './shaking-waves';

const DAY_MS = 86_400_000;
const YEAR_MS = 365 * DAY_MS;

function getEarthquake(patch: Partial<Earthquake>): Earthquake {
  return {
    id: 'eq',
    source: 'usgs',
    magnitude: 5,
    magnitudeType: 'mw',
    place: null,
    time: 0,
    depthKm: 10,
    longitude: 0,
    latitude: 0,
    url: 'https://example.com',
    ...patch,
  };
}

describe('getWaveSpanMs', () => {
  it('maps 2 s of a 30 s playback onto the window span', () => {
    expect(getWaveSpanMs(DAY_MS)).toBe(5_760_000);
    expect(getWaveSpanMs(7 * DAY_MS)).toBe(40_320_000);
  });
});

describe('getPlaybackSpanMs', () => {
  it('uses the playback range span when it is positive', () => {
    expect(getPlaybackSpanMs({ start: 1_000, end: 5_000 }, DAY_MS)).toBe(4_000);
  });

  it('falls back to the window span for an empty range', () => {
    expect(getPlaybackSpanMs({ start: 0, end: 0 }, DAY_MS)).toBe(DAY_MS);
  });
});

describe('mercator coordinates', () => {
  it('matches the MapLibre web mercator unit square', () => {
    expect(getMercatorX(-180)).toBe(0);
    expect(getMercatorX(0)).toBe(0.5);
    expect(getMercatorX(180)).toBe(1);
    expect(getMercatorY(0)).toBeCloseTo(0.5, 12);
    expect(getMercatorY(85.051129)).toBeCloseTo(0, 6);
    expect(getMercatorY(-85.051129)).toBeCloseTo(1, 6);
  });

  it('clamps polar latitudes instead of returning infinities', () => {
    expect(Number.isFinite(getMercatorY(90))).toBe(true);
    expect(getMercatorY(90)).toBe(getMercatorY(85.051129));
  });
});

describe('getWaveInstances', () => {
  const originMs = Date.UTC(2026, 0, 1);

  it('packs one row per felt earthquake in the documented order', () => {
    const quake = getEarthquake({
      magnitude: 6,
      depthKm: 20,
      longitude: 10,
      latitude: 45,
      time: originMs + 90_000,
    });
    const instances = getWaveInstances([quake], originMs);

    expect(instances.originMs).toBe(originMs);
    expect(instances.count).toBe(1);
    expect(instances.stride).toBe(WAVE_INSTANCE_STRIDE);
    expect(instances.data).toHaveLength(WAVE_INSTANCE_STRIDE);
    const [xHigh, yHigh, xLow, yLow, timeSec, reach, magnitude, depthKm] = instances.data;
    expect(xHigh + xLow).toBeCloseTo(getMercatorX(10), 12);
    expect(yHigh + yLow).toBeCloseTo(getMercatorY(45), 12);
    expect(timeSec).toBe(90);
    expect(reach).toBeCloseTo(getFeltReachKm({ magnitude: 6, depthKm: 20 }), 2);
    expect(magnitude).toBe(6);
    expect(depthKm).toBe(20);
  });

  it('skips earthquakes with no felt reach', () => {
    const unfelt = getEarthquake({ magnitude: -1, depthKm: 600 });
    expect(getFeltReachKm(unfelt)).toBe(0);

    const instances = getWaveInstances([unfelt, getEarthquake({ magnitude: 4 })], originMs);

    expect(instances.count).toBe(1);
    expect(instances.data[6]).toBe(4);
  });

  it('returns an empty buffer for no earthquakes', () => {
    const instances = getWaveInstances([], originMs);
    expect(instances.count).toBe(0);
    expect(instances.data).toHaveLength(0);
  });

  it('keeps time offsets within 1 s over a one-year range after the Float32 round-trip', () => {
    const offsetsMs = [0, 1_234, DAY_MS + 567, 180 * DAY_MS + 999, YEAR_MS - 1, YEAR_MS];
    const quakes = offsetsMs.map((offset) => getEarthquake({ time: originMs + offset }));
    const { data, stride } = getWaveInstances(quakes, originMs);

    offsetsMs.forEach((offset, index) => {
      expect(Math.abs(data[index * stride + 4] - offset / 1000)).toBeLessThanOrEqual(1);
    });
  });

  it('keeps split mercator coordinates within 1 mm after the Float32 round-trip', () => {
    const earthCircumferenceM = 2 * Math.PI * 6_371_008.8;
    const points = [
      [-179.99, -60.5],
      [-3.6, 37.18],
      [139.69, 35.69],
      [179.99, 70.1],
    ] as const;
    const quakes = points.map(([longitude, latitude]) => getEarthquake({ longitude, latitude }));
    const { data, stride } = getWaveInstances(quakes, originMs);

    points.forEach(([longitude, latitude], index) => {
      const row = data.subarray(index * stride, index * stride + 4);
      const errorX = Math.abs(row[0] + row[2] - getMercatorX(longitude));
      const errorY = Math.abs(row[1] + row[3] - getMercatorY(latitude));
      expect(errorX * earthCircumferenceM).toBeLessThan(0.001);
      expect(errorY * earthCircumferenceM).toBeLessThan(0.001);
    });
  });
});

describe('getFloat32Split', () => {
  it('splits a double into a float32 head and a float32 remainder', () => {
    const value = 1 / 7;
    const [high, low] = getFloat32Split(value);

    expect(high).toBe(Math.fround(value));
    expect(low).toBe(Math.fround(low));
    expect(Math.abs(high + low - value)).toBeLessThan(1e-14);
  });

  it('leaves no remainder for values float32 holds exactly', () => {
    expect(getFloat32Split(0.5)).toEqual([0.5, 0]);
  });
});

describe('getWorldCopies', () => {
  it('draws the neighbouring copies around a view inside one world', () => {
    expect(getWorldCopies(-100, 100)).toEqual([-1, 0, 1]);
  });

  it('covers every world a wide low-zoom view spans', () => {
    expect(getWorldCopies(-560, 560)).toEqual([-3, -2, -1, 0, 1, 2, 3]);
    expect(getWorldCopies(-200, 400)).toEqual([-2, -1, 0, 1, 2]);
  });

  it('follows a view panned onto another copy', () => {
    expect(getWorldCopies(370, 400)).toEqual([0, 1, 2]);
  });
});

describe('getTranslatedMatrix', () => {
  it('equals the matrix times a translation, column-major', () => {
    const matrix = Array.from({ length: 16 }, (_, index) => index + 1);
    const translated = getTranslatedMatrix(matrix, 2, 3);

    expect(Array.from(translated.subarray(0, 12))).toEqual(matrix.slice(0, 12));
    expect(Array.from(translated.subarray(12))).toEqual([
      1 * 2 + 5 * 3 + 13,
      2 * 2 + 6 * 3 + 14,
      3 * 2 + 7 * 3 + 15,
      4 * 2 + 8 * 3 + 16,
    ]);
  });

  it('cancels large terms in float64 before rounding to float32', () => {
    const scale = 2 ** 26;
    const centre = 8 / 9;
    const matrix = new Float64Array([
      scale,
      0,
      0,
      0,
      0,
      scale,
      0,
      0,
      0,
      0,
      1,
      0,
      -centre * scale,
      0,
      0,
      1,
    ]);
    const shift = 1 / scale;
    const translated = getTranslatedMatrix(matrix, centre + shift, 0);

    expect(translated[12]).toBeCloseTo(1, 6);
  });
});

describe('getWaveSeconds', () => {
  const life = { waveSpanMs: 2_000, feltReachKm: 300, depthKm: 40 };
  const totalSeconds = getArrivalSeconds(300, 40, S_WAVE_KM_S);

  it('squeezes the real seconds until the S wave reaches the felt reach into the wave span', () => {
    expect(getWaveSeconds({ ...life, ageMs: 0 })).toBe(0);
    expect(getWaveSeconds({ ...life, ageMs: 500 })).toBeCloseTo(totalSeconds / 4, 10);
    expect(getWaveSeconds({ ...life, ageMs: 2_000 })).toBeCloseTo(totalSeconds, 10);
  });

  it('gives a larger Earthquake more real seconds in the same wave span', () => {
    const small = getWaveSeconds({ ...life, ageMs: 2_000, feltReachKm: 50 });
    const large = getWaveSeconds({ ...life, ageMs: 2_000, feltReachKm: 900 });
    expect(large).toBeGreaterThan(small);
  });
});

describe('getWaveFrontKm', () => {
  const base = { waveSpanMs: 1_000, feltReachKm: 300, depthKm: 40, reducedMotion: false };
  const totalSeconds = getArrivalSeconds(300, 40, S_WAVE_KM_S);

  it('moves both fronts at their real speeds on the squeezed clock', () => {
    const seconds = totalSeconds * 0.5;
    expect(getWaveFrontKm({ ...base, wave: 's', ageMs: 500 })).toBeCloseTo(
      getWaveRadiusKm(seconds, 40, S_WAVE_KM_S),
      10,
    );
    expect(getWaveFrontKm({ ...base, wave: 'p', ageMs: 500 })).toBeCloseTo(
      getWaveRadiusKm(seconds, 40, P_WAVE_KM_S),
      10,
    );
  });

  it('leads with the P front and brings the S front to the felt reach at the end', () => {
    const p = getWaveFrontKm({ ...base, wave: 'p', ageMs: 400 }) ?? 0;
    const s = getWaveFrontKm({ ...base, wave: 's', ageMs: 400 }) ?? 0;
    expect(p).toBeGreaterThan(s);
    expect(getWaveFrontKm({ ...base, wave: 's', ageMs: 1_000 })).toBeCloseTo(300, 6);
  });

  it('keeps the S front at the Epicenter until it climbs up from the Depth', () => {
    const climbMs = (1_000 * (40 / S_WAVE_KM_S)) / totalSeconds;
    expect(getWaveFrontKm({ ...base, wave: 's', ageMs: climbMs * 0.9 })).toBe(0);
    expect(getWaveFrontKm({ ...base, wave: 's', ageMs: climbMs * 1.1 })).toBeGreaterThan(0);
  });

  it('drops the P front once it passes the felt reach', () => {
    const passMs = (1_000 * S_WAVE_KM_S) / P_WAVE_KM_S;
    expect(getWaveFrontKm({ ...base, wave: 'p', ageMs: passMs - 1 })).toBeLessThanOrEqual(300);
    expect(getWaveFrontKm({ ...base, wave: 'p', ageMs: passMs + 1 })).toBeNull();
  });

  it('is gone before the Earthquake and after the wave span', () => {
    expect(getWaveFrontKm({ ...base, wave: 's', ageMs: -1 })).toBeNull();
    expect(getWaveFrontKm({ ...base, wave: 's', ageMs: 1_001 })).toBeNull();
  });

  it('holds the S front at the felt reach and hides the P front with reduced motion', () => {
    const reduced = { ...base, reducedMotion: true };
    expect(getWaveFrontKm({ ...reduced, wave: 's', ageMs: 0 })).toBe(300);
    expect(getWaveFrontKm({ ...reduced, wave: 's', ageMs: 600 })).toBe(300);
    expect(getWaveFrontKm({ ...reduced, wave: 'p', ageMs: 100 })).toBeNull();
    expect(getWaveFrontKm({ ...reduced, wave: 's', ageMs: 1_001 })).toBeNull();
  });
});

describe('getWaveOpacity', () => {
  it.each([
    [1.99, 0],
    [2, 0.15],
    [2.4, 0.15],
    [4, 0.5],
    [6, 1],
    [9, 1],
  ])('intensity %d gives opacity %d', (intensity, expected) => {
    expect(getWaveOpacity(intensity)).toBeCloseTo(expected, 10);
  });
});

describe('getWaveFade', () => {
  it('fades over the wave life only with reduced motion', () => {
    expect(getWaveFade({ progress: 0.25, reducedMotion: true })).toBe(0.75);
    expect(getWaveFade({ progress: 0.25, reducedMotion: false })).toBe(1);
  });
});

describe('getWaveIntensity', () => {
  const quake = { magnitude: 6, depthKm: 10, radiusKm: 80 };

  it('takes the intensity at the front while the ring grows', () => {
    expect(getWaveIntensity({ ...quake, reducedMotion: false })).toBe(
      getIntensity({ ...quake, distanceKm: 80 }),
    );
  });

  it('takes the epicentral intensity with reduced motion', () => {
    expect(getWaveIntensity({ ...quake, reducedMotion: true })).toBe(
      getIntensity({ ...quake, distanceKm: 0 }),
    );
  });

  it('never drops below felt at the felt reach', () => {
    const reach = getFeltReachKm(quake);
    expect(getWaveIntensity({ ...quake, radiusKm: reach + 1, reducedMotion: false })).toBe(
      FELT_INTENSITY,
    );
  });
});

describe('getWaveStyle', () => {
  const quake = { magnitude: 6, depthKm: 10, waveSpanMs: 1_000 };
  const feltReachKm = getFeltReachKm(quake);
  const life = { ...quake, feltReachKm };

  it('is null outside the wave life', () => {
    expect(getWaveStyle({ ...life, wave: 's', ageMs: -1, reducedMotion: false })).toBeNull();
  });

  it('colours a growing S front by its intensity without fading', () => {
    const style = getWaveStyle({ ...life, wave: 's', ageMs: 250, reducedMotion: false });
    const radiusKm = getWaveFrontKm({ ...life, wave: 's', ageMs: 250, reducedMotion: false });
    const intensity = getIntensity({ ...quake, distanceKm: radiusKm ?? 0 });

    expect(style?.radiusKm).toBe(radiusKm);
    expect(style?.intensity).toBe(intensity);
    expect(style?.opacity).toBe(getWaveOpacity(intensity));
    expect(style?.color).toEqual(getWaveColor(intensity));
  });

  it('draws the P front ahead and fainter than the S front', () => {
    const p = getWaveStyle({ ...life, wave: 'p', ageMs: 250, reducedMotion: false });
    const s = getWaveStyle({ ...life, wave: 's', ageMs: 250, reducedMotion: false });
    const intensity = getIntensity({ ...quake, distanceKm: p?.radiusKm ?? 0 });

    expect(p?.radiusKm).toBeGreaterThan(s?.radiusKm ?? 0);
    expect(p?.opacity).toBeCloseTo(getWaveOpacity(intensity) * WAVE_FRONT_STYLES.p.opacity, 10);
  });

  it('colours a reduced-motion ring by the epicentre and fades it over the wave life', () => {
    const style = getWaveStyle({ ...life, wave: 's', ageMs: 250, reducedMotion: true });
    const intensity = getIntensity({ ...quake, distanceKm: 0 });

    expect(style?.radiusKm).toBe(feltReachKm);
    expect(style?.intensity).toBe(intensity);
    expect(style?.opacity).toBeCloseTo(getWaveOpacity(intensity) * 0.75, 10);
    expect(style?.color).toEqual(getWaveColor(intensity));
    expect(style?.opacity).toBeGreaterThan(0.5);
  });
});

describe('getWaveColor', () => {
  it('parses hex into unit RGB', () => {
    expect(getRgb('#ff8000')).toEqual([1, 128 / 255, 0]);
  });

  it('clamps to the ramp ends', () => {
    expect(getWaveColor(1)).toEqual(getRgb(WAVE_RAMP[0].hex));
    expect(getWaveColor(12)).toEqual(getRgb(WAVE_RAMP[WAVE_RAMP.length - 1].hex));
  });

  it('hits every stop exactly', () => {
    WAVE_RAMP.forEach(({ intensity, hex }) => {
      getWaveColor(intensity).forEach((channel, index) => {
        expect(channel).toBeCloseTo(getRgb(hex)[index], 10);
      });
    });
  });

  it('interpolates linearly between stops', () => {
    const [lower, upper] = [getRgb(WAVE_RAMP[0].hex), getRgb(WAVE_RAMP[1].hex)];
    const midIntensity = (WAVE_RAMP[0].intensity + WAVE_RAMP[1].intensity) / 2;
    getWaveColor(midIntensity).forEach((channel, index) => {
      expect(channel).toBeCloseTo((lower[index] + upper[index]) / 2, 10);
    });
  });

  it('brightens monotonically with intensity on the dark surface', () => {
    const luminances = [2, 3, 4, 5, 6, 7, 8].map((intensity) => {
      const [r, g, b] = getWaveColor(intensity);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    });
    luminances.slice(1).forEach((value, index) => {
      expect(value).toBeGreaterThan(luminances[index]);
    });
  });
});
