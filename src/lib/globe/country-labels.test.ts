import { describe, expect, it } from 'vitest';

import {
  getLabelOpacity,
  getPlacedLabels,
  isLabelRankShown,
  LABEL_FADE_DEGREES,
  LABEL_PADDING_PX,
} from './country-labels';
import { COUNTRY_LABELS } from './country-labels.data';
import type { GlobeView } from './motion';

const FRAME = { cx: 100, cy: 100, radius: 50 };
const CENTRED: GlobeView = { lon: 0, lat: 0, zoom: 1 };
const SIZE = { width: 40, height: 12 };

function getCosDegrees(degrees: number): number {
  return Math.cos((degrees * Math.PI) / 180);
}

describe('getLabelOpacity', () => {
  it('is fully opaque up to 75 degrees from the view centre', () => {
    expect(getLabelOpacity(1)).toBe(1);
    expect(getLabelOpacity(getCosDegrees(90 - LABEL_FADE_DEGREES))).toBe(1);
  });

  it('fades linearly in angle between 75 and 90 degrees', () => {
    expect(getLabelOpacity(getCosDegrees(82.5))).toBeCloseTo(0.5, 6);
  });

  it('is transparent at the limb and on the back face', () => {
    expect(getLabelOpacity(0)).toBe(0);
    expect(getLabelOpacity(-0.5)).toBe(0);
  });
});

describe('isLabelRankShown', () => {
  it('shows ranks up to zoom + 2', () => {
    expect(isLabelRankShown(3, 1)).toBe(true);
    expect(isLabelRankShown(4, 1)).toBe(false);
    expect(isLabelRankShown(7, 5)).toBe(true);
  });
});

describe('getPlacedLabels', () => {
  it('projects the view centre to the frame centre at full opacity', () => {
    const placed = getPlacedLabels([{ lat: 0, lon: 0, rank: 2 }], [SIZE], CENTRED, FRAME);
    expect(placed).toHaveLength(1);
    expect(placed[0]).toMatchObject({ index: 0, opacity: 1 });
    expect(placed[0].x).toBeCloseTo(100, 6);
    expect(placed[0].y).toBeCloseTo(100, 6);
  });

  it('draws positive latitude above the centre and positive longitude to its right', () => {
    const placed = getPlacedLabels(
      [
        { lat: 30, lon: 0, rank: 2 },
        { lat: 0, lon: 30, rank: 2 },
      ],
      [SIZE, SIZE],
      CENTRED,
      FRAME,
    );
    expect(placed[0].x).toBeCloseTo(100, 6);
    expect(placed[0].y).toBeCloseTo(75, 6);
    expect(placed[1].x).toBeCloseTo(125, 6);
    expect(placed[1].y).toBeCloseTo(100, 6);
  });

  it('scales the projection by zoom', () => {
    const placed = getPlacedLabels(
      [{ lat: 30, lon: 0, rank: 2 }],
      [SIZE],
      { ...CENTRED, zoom: 2 },
      FRAME,
    );
    expect(placed[0].y).toBeCloseTo(50, 6);
  });

  it('drops labels on the limb and on the back face', () => {
    const placed = getPlacedLabels(
      [
        { lat: 0, lon: 90, rank: 2 },
        { lat: 0, lon: 180, rank: 2 },
      ],
      [SIZE, SIZE],
      CENTRED,
      FRAME,
    );
    expect(placed).toEqual([]);
  });

  it('keeps only the first of two overlapping labels', () => {
    const placed = getPlacedLabels(
      [
        { lat: 0, lon: 0, rank: 2 },
        { lat: 0, lon: 0, rank: 3 },
      ],
      [SIZE, SIZE],
      CENTRED,
      FRAME,
    );
    expect(placed.map((label) => label.index)).toEqual([0]);
  });

  it('places both of two far-apart labels', () => {
    const placed = getPlacedLabels(
      [
        { lat: 30, lon: 0, rank: 2 },
        { lat: -30, lon: 0, rank: 2 },
      ],
      [SIZE, SIZE],
      CENTRED,
      FRAME,
    );
    expect(placed.map((label) => label.index)).toEqual([0, 1]);
  });

  it('keeps a padding gap between placed labels', () => {
    const point = { width: 0, height: 0 };
    const getPlacedCount = (gapPx: number) =>
      getPlacedLabels(
        [
          { lat: 0, lon: 0, rank: 2 },
          { lat: 0, lon: Math.asin(gapPx / FRAME.radius) * (180 / Math.PI), rank: 2 },
        ],
        [point, point],
        CENTRED,
        FRAME,
      ).length;
    expect(getPlacedCount(2 * LABEL_PADDING_PX - 1)).toBe(1);
    expect(getPlacedCount(2 * LABEL_PADDING_PX + 1)).toBe(2);
  });

  it('drops a label that would land on an obstacle', () => {
    const obstacle = { left: 90, top: 95, right: 110, bottom: 105 };
    const placed = getPlacedLabels(
      [
        { lat: 0, lon: 0, rank: 2 },
        { lat: 30, lon: 0, rank: 2 },
      ],
      [SIZE, SIZE],
      CENTRED,
      FRAME,
      [obstacle],
    );
    expect(placed.map((label) => label.index)).toEqual([1]);
  });

  it('keeps a padding gap between a label and an obstacle', () => {
    const point = { width: 0, height: 0 };
    const getPlacedCount = (gapPx: number) =>
      getPlacedLabels([{ lat: 0, lon: 0, rank: 2 }], [point], CENTRED, FRAME, [
        { left: 100 + gapPx, top: 0, right: 200, bottom: 200 },
      ]).length;
    expect(getPlacedCount(LABEL_PADDING_PX - 1)).toBe(0);
    expect(getPlacedCount(LABEL_PADDING_PX + 1)).toBe(1);
  });

  it('reveals higher ranks as the view zooms in', () => {
    const label = [{ lat: 0, lon: 0, rank: 5 }];
    expect(getPlacedLabels(label, [SIZE], { ...CENTRED, zoom: 2 }, FRAME)).toEqual([]);
    expect(getPlacedLabels(label, [SIZE], { ...CENTRED, zoom: 3 }, FRAME)).toHaveLength(1);
  });

  it('centres a label beside the antimeridian when the view looks at lon 180', () => {
    const fijiLat = -17.83;
    const view = { lon: Math.PI, lat: (fijiLat * Math.PI) / 180, zoom: 1 };
    const placed = getPlacedLabels([{ lat: fijiLat, lon: 177.98, rank: 2 }], [SIZE], view, FRAME);
    expect(placed).toHaveLength(1);
    expect(Math.abs(placed[0].x - 100)).toBeLessThan(3);
    expect(placed[0].x).toBeLessThan(100);
    expect(Math.abs(placed[0].y - 100)).toBeLessThan(3);
  });
});

describe('COUNTRY_LABELS', () => {
  it('holds 242 countries named in every locale', () => {
    expect(COUNTRY_LABELS).toHaveLength(242);
    for (const label of COUNTRY_LABELS) {
      expect(label.name.en).not.toBe('');
      expect(label.name.es).not.toBe('');
      expect(label.name.pt).not.toBe('');
    }
  });

  it('is sorted by rank within 2 to 7', () => {
    const ranks = COUNTRY_LABELS.map((label) => label.rank);
    expect(ranks).toEqual(ranks.toSorted((a, b) => a - b));
    expect(Math.min(...ranks)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...ranks)).toBeLessThanOrEqual(7);
  });

  it('names Spain in Spanish', () => {
    expect(COUNTRY_LABELS.find((label) => label.name.en === 'Spain')?.name.es).toBe('España');
  });
});
