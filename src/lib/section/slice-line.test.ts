import { describe, expect, it } from 'vitest';

import { EARTH_RADIUS_KM } from '@/lib/globe/quakes';

import { SLICE_LOOK, getSliceLines, getSliceOffset } from './slice-line';

const KM_PER_DEGREE = (Math.PI * EARTH_RADIUS_KM) / 180;

describe('slice line', () => {
  it('samples 900 km west to east through the epicentre', () => {
    const [front] = getSliceLines(0, 100);

    expect(front).toHaveLength(SLICE_LOOK.samples);
    expect(front[0][0]).toBeCloseTo(100 - 450 / KM_PER_DEGREE, 4);
    expect(front.at(-1)?.[0]).toBeCloseTo(100 + 450 / KM_PER_DEGREE, 4);
    expect(front[(SLICE_LOOK.samples - 1) / 2]).toEqual([100, 0]);
    expect(front.every(([, lat]) => Math.abs(lat) < 1e-9)).toBe(true);
  });

  it('stacks lines behind the slice, stepping north', () => {
    const lines = getSliceLines(-15, 167);
    const centre = (SLICE_LOOK.samples - 1) / 2;

    expect(lines).toHaveLength(SLICE_LOOK.backLines + 1);
    expect(lines[1][centre][1]).toBeCloseTo(-15 + SLICE_LOOK.backStepKm / KM_PER_DEGREE, 6);
    expect(lines.at(-1)?.[centre][1]).toBeCloseTo(
      -15 + (SLICE_LOOK.backLines * SLICE_LOOK.backStepKm) / KM_PER_DEGREE,
      6,
    );
  });

  it('keeps longitudes continuous across the antimeridian', () => {
    const [front] = getSliceLines(-18.5, -177.8);
    const steps = front.slice(1).map(([lon], index) => lon - front[index][0]);

    expect(Math.min(...steps)).toBeGreaterThan(0);
    expect(front[0][0]).toBeLessThan(-180);
  });

  it('places another earthquake along the slice and how far north of it', () => {
    const offset = getSliceOffset(
      { latitude: 0, longitude: 100 },
      { latitude: 0.5, longitude: 101 },
    );

    expect(offset.alongKm).toBeCloseTo(KM_PER_DEGREE, 0);
    expect(offset.northKm).toBeCloseTo(0.5 * KM_PER_DEGREE, 0);
  });

  it('places earthquakes west of and south of the epicentre at negative offsets', () => {
    const offset = getSliceOffset(
      { latitude: -15, longitude: 167 },
      { latitude: -15.2, longitude: 166 },
    );

    expect(offset.alongKm).toBeLessThan(-100);
    expect(offset.northKm).toBeLessThan(-20);
  });
});
