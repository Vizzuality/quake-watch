import { describe, expect, it } from 'vitest';

import type { Earthquake } from '@/lib/earthquakes/types';

import type { CrustColumn } from './crust-layers';
import { SECTION_FRAME } from './depth-scale';
import { type SectionInput, getPointsAttribute, getSectionModel } from './section-model';
import { SLICE_LOOK, getSliceLines } from './slice-line';

const CRUST: CrustColumn = { sedimentsKm: 1, upperKm: 6, middleKm: 6, lowerKm: 7 };

function getEarthquake(overrides: Partial<Earthquake> = {}): Earthquake {
  return {
    id: 'main',
    source: 'usgs',
    magnitude: 4.7,
    magnitudeType: 'mb',
    place: null,
    time: 0,
    depthKm: 10,
    latitude: -15,
    longitude: 167,
    url: '',
    ...overrides,
  };
}

function getInput(overrides: Partial<SectionInput> = {}): SectionInput {
  const earthquake = overrides.earthquake ?? getEarthquake();
  const lines = getSliceLines(earthquake.latitude, earthquake.longitude);
  return {
    earthquake,
    elevationsM: lines.map((line) => line.map(() => -2000)),
    getCrust: () => CRUST,
    getSlabDepthKm: () => null,
    others: [],
    ...overrides,
  };
}

function getYs(points: string): number[] {
  return points.split(' ').map((pair) => Number(pair.split(',')[1]));
}

describe('section model', () => {
  it('puts the hypocentre at the centre of the slice, at its depth', () => {
    const { hypocentre } = getSectionModel(getInput());

    expect(hypocentre.x).toBe(SECTION_FRAME.centre);
    expect(hypocentre.y).toBe(405);
    expect(hypocentre.surfaceY).toBe(SECTION_FRAME.seaLevelY);
  });

  it('fills the sea between sea level and the sea floor, then stacks CRUST1.0 below', () => {
    const { front } = getSectionModel(getInput());
    const [water, sediments, upper, , , mantle] = front.bands;

    expect(water.id).toBe('water');
    expect(Math.min(...getYs(water.polygon))).toBe(330);
    expect(Math.max(...getYs(water.polygon))).toBe(345);
    expect(Math.max(...getYs(sediments.polygon))).toBe(352.5);
    expect(upper.top.startsWith(`${SECTION_FRAME.left},352.5`)).toBe(true);
    expect(mantle.id).toBe('mantle');
  });

  it('gives land no water and lifts its surface above sea level', () => {
    const input = getInput();
    const { front, hypocentre } = getSectionModel({
      ...input,
      elevationsM: input.elevationsM.map((line) => Array.from(line, () => 1000)),
    });

    expect(new Set(getYs(front.bands[0].polygon))).toEqual(new Set([322.5]));
    expect(hypocentre.surfaceY).toBe(322.5);
  });

  it('stacks the back lines up and to the right, farthest first', () => {
    const { backLines } = getSectionModel(getInput());

    expect(backLines).toHaveLength(SLICE_LOOK.backLines);
    expect(backLines[0].index).toBe(SLICE_LOOK.backLines);
    expect(backLines[0].line.startsWith('657,279')).toBe(true);
    expect(backLines.at(-1)?.line.startsWith('586.8,343.4')).toBe(true);
    expect(backLines[0].opacity).toBeLessThan(backLines.at(-1)?.opacity ?? 0);
  });

  it('draws the sinking plate only where Slab2 maps it', () => {
    const input = getInput();
    const { slab } = getSectionModel({
      ...input,
      getSlabDepthKm: (lon) => (lon > 167 ? 10 + (lon - 167) * 100 : null),
    });

    expect(slab).not.toBeNull();
    expect(slab?.front).toHaveLength(1);
    expect(slab?.label.x).toBeLessThan(SECTION_FRAME.right);
    expect(slab?.label.anchor).toBe('end');
    expect(slab?.depthAtEpicentreKm).toBeNull();
  });

  it('labels a plate that deepens westwards on the side away from the depth axis', () => {
    const input = getInput();
    const { slab } = getSectionModel({
      ...input,
      getSlabDepthKm: (lon) => (lon < 167 ? 10 + (167 - lon) * 60 : null),
    });

    expect(slab?.label.anchor).toBe('start');
    expect(slab?.label.x).toBeGreaterThan(SECTION_FRAME.left);
  });

  it('omits the plate when the slice crosses no Slab2 region', () => {
    expect(getSectionModel(getInput()).slab).toBeNull();
  });

  it('projects other earthquakes within 100 km of the slice onto it', () => {
    const near = getEarthquake({ id: 'near', latitude: -14.5, longitude: 168, depthKm: 100 });
    const far = getEarthquake({ id: 'far', latitude: -10, longitude: 168 });
    const beyond = getEarthquake({ id: 'beyond', latitude: -15, longitude: 172 });
    const input = getInput();

    const { others } = getSectionModel({ ...input, others: [input.earthquake, near, far, beyond] });

    expect(others.map(({ id }) => id)).toEqual(['near']);
    expect(others[0].x).toBeGreaterThan(SECTION_FRAME.centre);
    expect(others[0].y).toBeCloseTo(490.5);
    expect(others[0].topY).toBe(SECTION_FRAME.seaLevelY);
  });

  it('deepens the axis only for earthquakes drawn on the slice', () => {
    const input = getInput();
    const deepFar = getEarthquake({ id: 'deep-far', latitude: -10, longitude: 168, depthKm: 600 });
    const deepNear = getEarthquake({
      id: 'deep-near',
      latitude: -15,
      longitude: 168,
      depthKm: 600,
    });

    expect(getSectionModel({ ...input, others: [deepFar] }).scale.bottomDepthKm).toBe(300);
    expect(getSectionModel({ ...input, others: [deepNear] }).scale.bottomDepthKm).toBe(600);
  });

  it('summarises the ground under the epicentre for the text alternative', () => {
    const input = getInput({ earthquake: getEarthquake({ depthKm: 12 }) });

    const { facts } = getSectionModel({ ...input, getSlabDepthKm: () => 40 });

    expect(facts).toEqual({
      layer: 'middle',
      surfaceElevationM: -2000,
      crustThicknessKm: 20,
      slabDepthKm: 40,
    });
  });

  it('formats points for SVG with one decimal', () => {
    expect(
      getPointsAttribute([
        [1, 2.25],
        [3.04, 4],
      ]),
    ).toBe('1,2.3 3,4');
  });
});
