import { describe, expect, it } from 'vitest';

import { shakemapContours } from '@/test/fixtures/shakemap-contours';

import { getDistanceKm, getRadians } from '../earthquakes/distance';
import { FELT_INTENSITY, getFeltReachKm, getIntensity } from '../earthquakes/intensity';
import type { SearchCenter } from '../earthquakes/search-schema';
import { getCirclePosition } from '../map/search-area';
import { getShakemapContours } from './contours';
import type { ShakemapContour } from './contours';
import {
  TRAIN_BEARINGS,
  TRAIN_CROSS_MS,
  TRAIN_INTERVAL_MS,
  getIsoseismalProfiles,
  getMergedBounds,
  getTrainBounds,
  getTrainFronts,
  getTrainReachKm,
  getWaveTrainShape,
} from './wave-train';
import type { IsoseismalProfile, TrainFront, WaveTrainShape } from './wave-train';

const epicenter = { latitude: 10, longitude: -80 };
const POLYGON_STEPS = 64;
const KM_PER_DEGREE_LATITUDE = 110.574;
const KM_PER_DEGREE_LONGITUDE = 111.32 * Math.cos(getRadians(epicenter.latitude));

function getPolygonLine(
  center: SearchCenter,
  getRadiusKm: (bearing: number) => number,
): Array<readonly [number, number]> {
  return Array.from({ length: POLYGON_STEPS + 1 }, (_, index) => {
    const bearing = (2 * Math.PI * index) / POLYGON_STEPS;
    return getCirclePosition(center, getRadiusKm(bearing), bearing);
  });
}

function getCircleContour(mmi: number, color: string, radiusKm: number): ShakemapContour {
  return { mmi, color, lines: [getPolygonLine(epicenter, () => radiusKm)] };
}

function getFrontDistancesKm(front: TrainFront): number[] {
  return front.geometry.coordinates.map(([longitude, latitude]) =>
    getDistanceKm(epicenter, { latitude, longitude }),
  );
}

function getPlanePosition(xKm: number, yKm: number): readonly [number, number] {
  return [
    epicenter.longitude + xKm / KM_PER_DEGREE_LONGITUDE,
    epicenter.latitude + yKm / KM_PER_DEGREE_LATITUDE,
  ];
}

function getElapsedMsAt(shape: WaveTrainShape, distanceKm: number): number {
  return (distanceKm / getTrainReachKm(shape)) * TRAIN_CROSS_MS;
}

function getFrontAt(shape: WaveTrainShape, distanceKm: number): TrainFront {
  const elapsedMs = getElapsedMsAt(shape, distanceKm);
  return getTrainFronts(shape, epicenter, elapsedMs).features[
    Math.floor(elapsedMs / TRAIN_INTERVAL_MS)
  ];
}

function getCircleShare(distanceKm: number): number {
  const shake = { magnitude: 6, depthKm: 10 };
  const share =
    (getIntensity({ ...shake, distanceKm }) - FELT_INTENSITY) /
    (getIntensity({ ...shake, distanceKm: 0 }) - FELT_INTENSITY);
  return Math.min(1, Math.max(0.15, share));
}

function getMeanKm(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getUniformProfile(mmi: number, color: string, radiusKm: number): IsoseismalProfile {
  return {
    mmi,
    color,
    radiiKm: new Float64Array(TRAIN_BEARINGS).fill(radiusKm),
    meanRadiusKm: radiusKm,
  };
}

function getRgbChannels(color: string | null): number[] {
  return [...(color ?? '').matchAll(/\d+/g)].map(([value]) => Number(value));
}

const nestedShape: WaveTrainShape = {
  kind: 'isoseismal',
  profiles: [getUniformProfile(6, '#ff0000', 10), getUniformProfile(4, '#0000ff', 30)],
};
const circleShape = getWaveTrainShape(null, { ...epicenter, magnitude: 6, depthKm: 10 });

function getBinLine(getRadiusKm: (bin: number) => number): Array<readonly [number, number]> {
  const line = Array.from({ length: TRAIN_BEARINGS }, (_, bin) => {
    const angle = (2 * Math.PI * (bin + 0.5)) / TRAIN_BEARINGS;
    const radiusKm = getRadiusKm(bin);
    return getPlanePosition(radiusKm * Math.cos(angle), radiusKm * Math.sin(angle));
  });
  return [...line, line[0]];
}

describe('getIsoseismalProfiles', () => {
  it('smooths away a single-bearing spike from a detached contour piece', () => {
    const spikeBin = 40;
    const spikeAngle = (2 * Math.PI * spikeBin) / TRAIN_BEARINGS;
    const line = getBinLine(() => 10);
    line.splice(
      spikeBin,
      0,
      getPlanePosition(30 * Math.cos(spikeAngle), 30 * Math.sin(spikeAngle)),
    );
    const [profile] = getIsoseismalProfiles(
      [{ mmi: 5, color: '#00ff00', lines: [line] }],
      epicenter,
    );
    for (const radius of profile.radiiKm) {
      expect(radius).toBeGreaterThanOrEqual(9.5);
      expect(radius).toBeLessThanOrEqual(10.5);
    }
  });

  it('keeps a real lobe spanning many bearings', () => {
    const line = getBinLine((bin) => (bin >= 60 && bin < 80 ? 20 : 10));
    const [profile] = getIsoseismalProfiles(
      [{ mmi: 5, color: '#00ff00', lines: [line] }],
      epicenter,
    );
    expect(Math.max(...profile.radiiKm)).toBeGreaterThanOrEqual(18);
  });

  it('measures a square contour along every bearing ray', () => {
    const corners = [
      getPlanePosition(10, 10),
      getPlanePosition(-10, 10),
      getPlanePosition(-10, -10),
      getPlanePosition(10, -10),
    ];
    const [profile] = getIsoseismalProfiles(
      [{ mmi: 6, color: '#ff0000', lines: [[...corners, corners[0]]] }],
      epicenter,
    );
    profile.radiiKm.forEach((radius, bin) => {
      const angle = (2 * Math.PI * bin) / TRAIN_BEARINGS;
      const expectedKm = 10 / Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)));
      expect(Math.abs(radius - expectedKm) / expectedKm).toBeLessThan(0.04);
    });
  });

  it('measures a closed contour at its radius on every bearing', () => {
    const [profile] = getIsoseismalProfiles([getCircleContour(6, '#ff0000', 10)], epicenter);
    expect(profile.radiiKm).toHaveLength(TRAIN_BEARINGS);
    for (const radius of profile.radiiKm) expect(radius).toBeCloseTo(10, 0);
    expect(profile.meanRadiusKm).toBeCloseTo(10, 0);
  });

  it('sorts profiles from the highest intensity outward', () => {
    const profiles = getIsoseismalProfiles(
      [getCircleContour(4, '#0000ff', 30), getCircleContour(6, '#ff0000', 10)],
      epicenter,
    );
    expect(profiles.map(({ mmi }) => mmi)).toEqual([6, 4]);
    expect(profiles[1].meanRadiusKm).toBeCloseTo(30, 0);
  });

  it('keeps an outer profile outside the inner one where its contour dips inside', () => {
    const dipping: ShakemapContour = {
      mmi: 4,
      color: '#0000ff',
      lines: [getPolygonLine(epicenter, (bearing) => (bearing < 1 ? 5 : 30))],
    };
    const [inner, outer] = getIsoseismalProfiles(
      [getCircleContour(6, '#ff0000', 20), dipping],
      epicenter,
    );
    expect(Math.min(...outer.radiiKm)).toBeLessThan(30);
    for (let bin = 0; bin < TRAIN_BEARINGS; bin += 1) {
      expect(outer.radiiKm[bin]).toBeGreaterThanOrEqual(inner.radiiKm[bin]);
    }
  });

  it('merges contour features sharing one intensity and keeps the farthest hit', () => {
    const profiles = getIsoseismalProfiles(
      [getCircleContour(5, '#00ff00', 10), getCircleContour(5, '#00ff00', 25)],
      epicenter,
    );
    expect(profiles).toHaveLength(1);
    expect(profiles[0].meanRadiusKm).toBeCloseTo(25, 0);
  });

  it('interpolates bearings an open contour never crosses', () => {
    const halfCircle: ShakemapContour = {
      mmi: 5,
      color: '#00ff00',
      lines: [getPolygonLine(epicenter, () => 15).slice(0, POLYGON_STEPS / 2 + 1)],
    };
    const [profile] = getIsoseismalProfiles([halfCircle], epicenter);
    for (const radius of profile.radiiKm) {
      expect(Number.isFinite(radius)).toBe(true);
      expect(radius).toBeCloseTo(15, 0);
    }
  });

  it('extends a single hit bearing to every bearing', () => {
    const [longitude] = getCirclePosition(epicenter, 12, Math.PI / 2);
    const [profile] = getIsoseismalProfiles(
      [
        {
          mmi: 5,
          color: '#00ff00',
          lines: [
            [
              [longitude, epicenter.latitude - 0.001],
              [longitude, epicenter.latitude + 0.001],
            ],
          ],
        },
      ],
      epicenter,
    );
    expect(new Set(profile.radiiKm).size).toBe(1);
    expect(profile.radiiKm[0]).toBeCloseTo(12, 0);
  });

  it('drops a contour that no bearing ray crosses', () => {
    const degenerate: ShakemapContour = {
      mmi: 5,
      color: '#00ff00',
      lines: [
        [
          [-79.9, 10.1],
          [-79.9, 10.1],
        ],
      ],
    };
    expect(getIsoseismalProfiles([degenerate], epicenter)).toEqual([]);
  });

  it('interpolates a contour that does not surround the Epicenter', () => {
    const [longitude] = getCirclePosition(epicenter, 50, Math.PI / 2);
    const [profile] = getIsoseismalProfiles(
      [
        {
          mmi: 5,
          color: '#00ff00',
          lines: [getPolygonLine({ latitude: epicenter.latitude, longitude }, () => 10)],
        },
      ],
      epicenter,
    );
    for (const radius of profile.radiiKm) {
      expect(Number.isFinite(radius)).toBe(true);
      expect(radius).toBeGreaterThanOrEqual(39.5);
      expect(radius).toBeLessThanOrEqual(60.5);
    }
  });

  it('measures a contour across the antimeridian from its local plane', () => {
    const center = { latitude: 0, longitude: 179.9 };
    const line = getPolygonLine(center, () => 30).map(
      ([longitude, latitude]) => [longitude > 180 ? longitude - 360 : longitude, latitude] as const,
    );
    expect(line.some(([longitude]) => longitude < 0)).toBe(true);
    const [profile] = getIsoseismalProfiles([{ mmi: 5, color: '#00ff00', lines: [line] }], center);
    for (const radius of profile.radiiKm) expect(radius).toBeCloseTo(30, 0);
  });
});

describe('getWaveTrainShape', () => {
  it('follows the isoseismals when the ShakeMap has contours', () => {
    const shape = getWaveTrainShape([getCircleContour(6, '#ff0000', 10)], {
      ...epicenter,
      magnitude: 6,
      depthKm: 10,
    });
    expect(shape.kind).toBe('isoseismal');
    expect(getTrainReachKm(shape)).toBeCloseTo(10, 0);
  });

  it('falls back to circles when the contours collapse onto the Epicenter', () => {
    const shape = getWaveTrainShape(
      [
        {
          mmi: 6,
          color: '#ff0000',
          lines: [[[epicenter.longitude, epicenter.latitude], getPlanePosition(10, 0)]],
        },
      ],
      { ...epicenter, magnitude: 6, depthKm: 10 },
    );
    expect(shape.kind).toBe('circle');
  });

  it('falls back to circles up to the Felt reach without contours', () => {
    const shape = getWaveTrainShape([], { ...epicenter, magnitude: 6, depthKm: 10 });
    expect(shape).toEqual({
      kind: 'circle',
      reachKm: getFeltReachKm({ magnitude: 6, depthKm: 10 }),
      magnitude: 6,
      depthKm: 10,
      observed: false,
    });
    expect(getTrainReachKm(shape)).toBe(getFeltReachKm({ magnitude: 6, depthKm: 10 }));
  });

  it('reaches the farthest felt report when one is observed', () => {
    const shape = getWaveTrainShape(null, { ...epicenter, magnitude: 4.5, depthKm: 124 }, 320);
    expect(shape).toEqual({
      kind: 'circle',
      reachKm: 320,
      magnitude: 4.5,
      depthKm: 124,
      observed: true,
    });
  });

  it('keeps the isoseismals over an observed reach', () => {
    const shape = getWaveTrainShape(
      [getCircleContour(6, '#ff0000', 10)],
      { ...epicenter, magnitude: 6, depthKm: 10 },
      320,
    );
    expect(shape.kind).toBe('isoseismal');
  });

  it('estimates the reach when no report is observed', () => {
    const shape = getWaveTrainShape(null, { ...epicenter, magnitude: 6, depthKm: 10 }, 0);
    expect(shape).toMatchObject({ observed: false });
    expect(getTrainReachKm(shape)).toBe(getFeltReachKm({ magnitude: 6, depthKm: 10 }));
  });
});

describe('getTrainFronts', () => {
  const ellipseShape = getWaveTrainShape(
    [
      {
        mmi: 4,
        color: '#0000ff',
        lines: [getPolygonLine(epicenter, (bearing) => 37.5 - 7.5 * Math.cos(2 * bearing))],
      },
      {
        mmi: 6,
        color: '#ff0000',
        lines: [getPolygonLine(epicenter, (bearing) => 15 - 5 * Math.cos(2 * bearing))],
      },
    ],
    { ...epicenter, magnitude: 6, depthKm: 10 },
  );

  it('takes the inner isoseismal shape when a front reaches it', () => {
    if (ellipseShape.kind !== 'isoseismal') throw new Error('expected isoseismal');
    const [inner] = ellipseShape.profiles;
    const front = getFrontAt(ellipseShape, inner.meanRadiusKm);
    expect(Math.max(...inner.radiiKm) - Math.min(...inner.radiiKm)).toBeGreaterThan(9);
    getFrontDistancesKm(front)
      .slice(0, TRAIN_BEARINGS)
      .forEach((distance, bin) => expect(distance).toBeCloseTo(inner.radiiKm[bin], 0));
  });

  it('morphs a front halfway between two anisotropic isoseismals', () => {
    if (ellipseShape.kind !== 'isoseismal') throw new Error('expected isoseismal');
    const [inner, outer] = ellipseShape.profiles;
    const front = getFrontAt(ellipseShape, (inner.meanRadiusKm + outer.meanRadiusKm) / 2);
    getFrontDistancesKm(front)
      .slice(0, TRAIN_BEARINGS)
      .forEach((distance, bin) =>
        expect(distance).toBeCloseTo((inner.radiiKm[bin] + outer.radiiKm[bin]) / 2, 0),
      );
  });

  it('follows the USGS contours of a real ShakeMap', () => {
    const center = { latitude: 37.5, longitude: -4.5 };
    const shape = getWaveTrainShape(getShakemapContours(shakemapContours), {
      ...center,
      magnitude: 5,
      depthKm: 10,
    });
    if (shape.kind !== 'isoseismal') throw new Error('expected isoseismal');
    expect(shape.profiles.length).toBeGreaterThan(1);
    shape.profiles.slice(1).forEach((profile, index) => {
      profile.radiiKm.forEach((radius, bin) => {
        expect(radius).toBeGreaterThanOrEqual(shape.profiles[index].radiiKm[bin]);
      });
    });
    const { features } = getTrainFronts(shape, center, 3_000);
    expect(features.length).toBeGreaterThanOrEqual(2);
    for (const { geometry, properties } of features) {
      expect(geometry.coordinates.flat().every(Number.isFinite)).toBe(true);
      expect(Number.isFinite(properties.opacity)).toBe(true);
    }
  });

  it('runs several fronts at once', () => {
    const { features } = getTrainFronts(circleShape, epicenter, 3_000);
    expect(features.length).toBeGreaterThanOrEqual(2);
    expect(features).toHaveLength(TRAIN_CROSS_MS / TRAIN_INTERVAL_MS);
  });

  it('closes every ring', () => {
    for (const shape of [circleShape, nestedShape]) {
      for (const { geometry } of getTrainFronts(shape, epicenter, 3_000).features) {
        expect(geometry.coordinates).toHaveLength(TRAIN_BEARINGS + 1);
        expect(geometry.coordinates[0]).toEqual(geometry.coordinates.at(-1));
      }
    }
  });

  it('moves a front outward at a constant km rate', () => {
    const reachKm = getTrainReachKm(circleShape);
    for (const elapsedMs of [250, 500, 1_000, 1_500]) {
      const [youngest] = getTrainFronts(circleShape, epicenter, elapsedMs).features;
      expect(getMeanKm(getFrontDistancesKm(youngest))).toBeCloseTo(
        (elapsedMs / TRAIN_CROSS_MS) * reachKm,
        3,
      );
    }
  });

  it('is already running before the first emission', () => {
    const { features } = getTrainFronts(circleShape, epicenter, -500);
    expect(features).toHaveLength(TRAIN_CROSS_MS / TRAIN_INTERVAL_MS);
  });

  it('morphs a front between two isoseismals', () => {
    const { features } = getTrainFronts(nestedShape, epicenter, 4_000);
    const front = features.at(-1);
    if (!front) throw new Error('missing front');
    for (const distance of getFrontDistancesKm(front)) expect(distance).toBeCloseTo(20, 0);
    const [red, green, blue] = getRgbChannels(front.properties.color);
    expect(red).toBeGreaterThanOrEqual(127);
    expect(red).toBeLessThanOrEqual(128);
    expect(green).toBe(0);
    expect(blue).toBeGreaterThanOrEqual(127);
    expect(blue).toBeLessThanOrEqual(128);
  });

  it('scales the innermost isoseismal inside it, in its colour', () => {
    const [youngest] = getTrainFronts(nestedShape, epicenter, 1_000).features;
    for (const distance of getFrontDistancesKm(youngest)) expect(distance).toBeCloseTo(5, 0);
    expect(youngest.properties).toEqual({ color: 'rgb(255, 0, 0)', opacity: 1 });
  });

  it('dims a front by how far it has crossed toward the outer isoseismal', () => {
    const front = getTrainFronts(nestedShape, epicenter, 5_100).features.at(-1);
    expect(front?.properties.opacity).toBeCloseTo(0.49625, 10);
  });

  it('dims fronts as they cross outer isoseismals and fades them at the reach', () => {
    const { features } = getTrainFronts(nestedShape, epicenter, 5_900);
    const opacities = features.map(({ properties }) => properties.opacity);
    expect(opacities[0]).toBeGreaterThan(opacities[1]);
    expect(opacities.at(-1)).toBeLessThan(0.1);
  });

  it('sets a circle front opacity from the estimated intensity at its distance', () => {
    const reachKm = getTrainReachKm(circleShape);
    const [youngest] = getTrainFronts(circleShape, epicenter, 1_000).features;
    expect(youngest.properties.opacity).toBeCloseTo(getCircleShare(reachKm / 6), 10);
    expect(getCircleShare(reachKm / 6)).toBeGreaterThan(0.15);
    const farthest = getTrainFronts(circleShape, epicenter, 5_100).features.at(-1);
    expect(farthest?.properties.opacity).toBeCloseTo(0.15, 10);
  });

  it('dims circle fronts with the estimated intensity', () => {
    const { features } = getTrainFronts(circleShape, epicenter, 1_000);
    expect(features.map(({ properties }) => properties.color)).toEqual([null, null, null]);
    const [young, middle] = features.map(({ properties }) => properties.opacity);
    expect(young).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThanOrEqual(0.15);
  });

  it('fades observed circle fronts linearly toward the farthest report', () => {
    const shape = getWaveTrainShape(null, { ...epicenter, magnitude: 4.5, depthKm: 124 }, 300);
    const [youngest] = getTrainFronts(shape, epicenter, 1_000).features;
    expect(youngest.properties.opacity).toBeCloseTo(1 - 0.85 / 6, 10);
    const middle = getTrainFronts(shape, epicenter, 3_000).features[1];
    expect(middle.properties.opacity).toBeCloseTo(1 - 0.85 / 2, 10);
    const farthest = getTrainFronts(shape, epicenter, 5_100).features.at(-1);
    expect(farthest?.properties.opacity).toBeCloseTo(1 - 0.85 * 0.85, 10);
  });

  it('draws no front where no shaking is felt', () => {
    const shape = getWaveTrainShape(null, { ...epicenter, magnitude: 1, depthKm: 50 });
    expect(getTrainReachKm(shape)).toBe(0);
    expect(getTrainFronts(shape, epicenter, 3_000).features).toEqual([]);
    expect(getTrainBounds(shape, epicenter)).toBeNull();
  });

  it('skips a front sitting on the Epicenter', () => {
    expect(getTrainFronts(circleShape, epicenter, 0).features).toHaveLength(2);
  });

  it('keeps a great earthquake fronts finite', () => {
    const shape = getWaveTrainShape(null, { ...epicenter, magnitude: 8, depthKm: 5 });
    for (const { geometry } of getTrainFronts(shape, epicenter, 5_999).features) {
      for (const position of geometry.coordinates) {
        expect(position.every(Number.isFinite)).toBe(true);
      }
    }
  });
});

describe('getTrainBounds', () => {
  it('frames the outermost isoseismal', () => {
    const bounds = getTrainBounds(nestedShape, epicenter);
    if (!bounds) throw new Error('missing bounds');
    const [west, south, east, north] = bounds;
    expect(getDistanceKm(epicenter, { latitude: epicenter.latitude, longitude: east })).toBeCloseTo(
      30,
      0,
    );
    expect(
      getDistanceKm(epicenter, { latitude: north, longitude: epicenter.longitude }),
    ).toBeCloseTo(30, 0);
    expect(west).toBeLessThan(epicenter.longitude);
    expect(south).toBeLessThan(epicenter.latitude);
  });

  it('frames the circle at the Felt reach', () => {
    const bounds = getTrainBounds(circleShape, epicenter);
    if (!bounds) throw new Error('missing bounds');
    const north = bounds[3];
    expect(
      getDistanceKm(epicenter, { latitude: north, longitude: epicenter.longitude }),
    ).toBeCloseTo(getTrainReachKm(circleShape), 0);
  });
});

describe('getMergedBounds', () => {
  it('returns the union of two bounds', () => {
    expect(getMergedBounds([-10, -5, 0, 5], [-4, -8, 6, 2])).toEqual([-10, -8, 6, 5]);
  });
});
