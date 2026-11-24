import { describe, expect, it } from 'vitest';

import {
  getAreaCaption,
  getFeltRingLabel,
  getFeltRingShortLabel,
  getStripQuakeLabel,
  getStripTickLabel,
} from './map-labels';

const THU_21_48 = Date.UTC(2026, 9, 29, 21, 48);

describe('getFeltRingLabel', () => {
  it('rounds the felt reach as the detail panel does', () => {
    expect(getFeltRingLabel(687.4, 'en')).toBe('Likely felt ~690 km');
    expect(getFeltRingLabel(687.4, 'es')).toBe('Probablemente sentido ~690 km');
  });
});

describe('getFeltRingShortLabel', () => {
  it('keeps only the rounded distance for tight phone rings', () => {
    expect(getFeltRingShortLabel(687.4, 'en')).toBe('~690 km');
    expect(getFeltRingShortLabel(1004, 'pt')).toBe('~1000 km');
  });
});

describe('getStripTickLabel', () => {
  it('names each UTC day by weekday and day of the month', () => {
    expect(getStripTickLabel({ time: Date.UTC(2026, 9, 27), kind: 'day' }, 'en')).toBe('Tue 27');
    expect(getStripTickLabel({ time: Date.UTC(2026, 10, 2), kind: 'day' }, 'en')).toBe('Mon 02');
  });

  it('names a week tick by day and month, and a month tick by month', () => {
    expect(getStripTickLabel({ time: Date.UTC(2026, 9, 5), kind: 'date' }, 'en')).toBe('05 Oct');
    expect(getStripTickLabel({ time: Date.UTC(2026, 9, 1), kind: 'month' }, 'es')).toBe('oct');
  });

  it('shows the UTC hour between days', () => {
    expect(getStripTickLabel({ time: Date.UTC(2026, 9, 27, 15), kind: 'hour' }, 'en')).toBe(
      '15:00',
    );
  });
});

describe('getStripQuakeLabel', () => {
  it('reads like the design: this quake, weekday and UTC time', () => {
    expect(getStripQuakeLabel(THU_21_48, 'en')).toBe('This earthquake · Thu 21:48');
    expect(getStripQuakeLabel(THU_21_48, 'pt')).toBe('Este sismo · quinta 21:48');
  });
});

describe('getAreaCaption', () => {
  it('names the Interval and counts the earthquakes in the area', () => {
    expect(getAreaCaption({ interval: '7d' }, 33, 'en')).toBe(
      'In this area this week · 33 earthquakes · Size = magnitude',
    );
    expect(getAreaCaption({ interval: '24h' }, 1, 'en')).toBe(
      'In this area in the last 24 hours · 1 earthquake · Size = magnitude',
    );
    expect(getAreaCaption({ interval: '3d' }, 2, 'es')).toBe(
      'En esta zona en los últimos 3 días · 2 terremotos · Tamaño = magnitud',
    );
  });

  it('names the year and the dates of a custom range', () => {
    expect(getAreaCaption({ interval: '1y' }, 2, 'en')).toBe(
      'In this area in the last year · 2 earthquakes · Size = magnitude',
    );
    expect(
      getAreaCaption({ interval: 'custom', from: '2026-01-01', to: '2026-01-31' }, 2, 'en'),
    ).toBe('In this area from Jan 1, 2026 to Jan 31, 2026 · 2 earthquakes · Size = magnitude');
  });
});
