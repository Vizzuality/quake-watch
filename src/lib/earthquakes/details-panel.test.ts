import { describe, expect, it } from 'vitest';

import {
  getDepthClass,
  getDepthClassLabel,
  getDepthScaleFraction,
  getDetailsDate,
  getEarthquakePosition,
  getFeltReports,
  getMagnitudeTypeCaption,
  getMagnitudeValueLabel,
  getPositionLabel,
  getTimeOrderedEarthquakes,
} from './details-panel';
import type { EarthquakeDetail } from './details/query-options';
import type { UsgsEarthquakeDetail } from './details/usgs';
import type { Earthquake } from './types';

function getQuake(id: string, time: number): Earthquake {
  return {
    id,
    source: 'emsc',
    magnitude: 5,
    magnitudeType: 'mb',
    place: null,
    time,
    depthKm: 10,
    longitude: 0,
    latitude: 0,
    url: '',
  };
}

const LATE = getQuake('late', 300);
const EARLY = getQuake('early', 100);
const MIDDLE = getQuake('middle', 200);

function getUsgsDetail(dyfiResponses: number | null): EarthquakeDetail {
  const detail = {
    earthquake: LATE,
    impact: { dyfiResponses, pagerAlert: null, shakemapMaxMmi: null, dyfiMaxMmi: null },
  } as unknown as UsgsEarthquakeDetail;
  return { source: 'usgs', detail };
}

describe('getEarthquakePosition', () => {
  const ordered = getTimeOrderedEarthquakes([LATE, EARLY, MIDDLE]);

  it('orders by time and returns neighbours', () => {
    expect(getEarthquakePosition(ordered, 'emsc:middle')).toEqual({
      index: 2,
      total: 3,
      previous: EARLY,
      next: LATE,
    });
  });

  it('has no previous at the first and no next at the last', () => {
    expect(getEarthquakePosition(ordered, 'emsc:early')?.previous).toBeNull();
    expect(getEarthquakePosition(ordered, 'emsc:late')?.next).toBeNull();
  });

  it('returns null for a quake outside the list', () => {
    expect(getEarthquakePosition(ordered, 'usgs:middle')).toBeNull();
  });
});

describe('getPositionLabel', () => {
  it('pads the index to the width of the total', () => {
    const position = { index: 83, total: 360, previous: null, next: null };
    expect(getPositionLabel(position, 'en')).toBe('Event 083 / 360');
    expect(getPositionLabel(position, 'es')).toBe('Evento 083 / 360');
  });
});

describe('getDepthClass', () => {
  it.each([
    [0, 'shallow'],
    [69.9, 'shallow'],
    [70, 'intermediate'],
    [299, 'intermediate'],
    [300, 'deep'],
    [650, 'deep'],
  ] as const)('classes %d km as %s', (depthKm, depthClass) => {
    expect(getDepthClass(depthKm)).toBe(depthClass);
  });

  it('labels the class per locale', () => {
    expect(getDepthClassLabel(143, 'en')).toBe('Intermediate');
    expect(getDepthClassLabel(10, 'es')).toBe('Superficial');
  });
});

describe('getDepthScaleFraction', () => {
  it.each([
    [-5, 0],
    [350, 0.5],
    [700, 1],
    [900, 1],
  ])('places %d km at %d of the scale', (depthKm, fraction) => {
    expect(getDepthScaleFraction(depthKm)).toBe(fraction);
  });
});

describe('getMagnitudeValueLabel', () => {
  it('keeps one decimal per locale', () => {
    expect(getMagnitudeValueLabel(6, 'en')).toBe('6.0');
    expect(getMagnitudeValueLabel(6.24, 'es')).toBe('6,2');
  });
});

describe('getMagnitudeTypeCaption', () => {
  it.each([
    ['mww', 'moment magnitude'],
    ['Mw', 'moment magnitude'],
    ['mb', 'body-wave magnitude'],
    ['ML', 'local magnitude'],
    ['ms_20', 'surface-wave magnitude'],
    ['md', 'duration magnitude'],
    ['mi', 'magnitude'],
  ])('describes %s as %s', (magnitudeType, caption) => {
    expect(getMagnitudeTypeCaption(magnitudeType, 'en')).toBe(caption);
  });
});

describe('getDetailsDate', () => {
  it('formats the UTC date with year and approximate time', () => {
    expect(getDetailsDate(Date.UTC(2026, 9, 29, 21, 48), 'en')).toBe(
      'Thu 29.10.2026 · ≈ 21:48 UTC',
    );
  });
});

describe('getFeltReports', () => {
  it('reads DYFI responses from USGS details', () => {
    expect(getFeltReports(getUsgsDetail(5))).toBe(5);
    expect(getFeltReports(getUsgsDetail(null))).toBeNull();
  });

  it('has no felt reports for EMSC or a missing detail', () => {
    const emsc: EarthquakeDetail = {
      source: 'emsc',
      detail: {
        earthquake: LATE,
        author: null,
        sourceCatalog: null,
        flynnRegion: null,
        lastUpdate: null,
      },
    };
    expect(getFeltReports(emsc)).toBeNull();
    expect(getFeltReports(null)).toBeNull();
  });
});
