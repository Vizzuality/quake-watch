import { describe, expect, it } from 'vitest';

import { getFeltReports } from './csv';

const CSV = [
  '#unid=20261009_0000264',
  '#longitude,latitude,time,source,iraw,icorr',
  '-3.70,40.41,2026-10-09T01:02:03Z,app,3.2,3.4',
  '',
  '2.15,41.38,2026-10-09T01:02:09Z,web,5,5.8',
  '',
].join('\r\n');

describe('getFeltReports', () => {
  it('reads longitude, latitude, time and the raw Intensity, skipping # lines and blanks', () => {
    expect(getFeltReports(CSV)).toEqual([
      { longitude: -3.7, latitude: 40.41, time: '2026-10-09T01:02:03Z', rawIntensity: 3.2 },
      { longitude: 2.15, latitude: 41.38, time: '2026-10-09T01:02:09Z', rawIntensity: 5 },
    ]);
  });

  it('skips rows with non-finite or missing numbers', () => {
    const csv = ['x,40,t,app,3,3', '1,y,t,app,3,3', '1,40,t,app,,3', '1,40,t', '1,40,t,app,NaN,3'];
    expect(getFeltReports(csv.join('\n'))).toEqual([]);
  });

  it('handles an empty file', () => {
    expect(getFeltReports('')).toEqual([]);
  });
});
