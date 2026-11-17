import { describe, expect, it } from 'vitest';

import {
  getDistanceWindowKm,
  getSequenceBlurb,
  getSequenceOf,
  getSequenceRoleLabel,
  getSequenceRows,
  getSequences,
  getTimeWindowMs,
} from './sequences';
import type { Earthquake } from './types';

const HOUR_MS = 3_600_000;
const START = Date.UTC(2026, 9, 29, 21, 48);

function getQuake(
  id: string,
  magnitude: number,
  hours: number,
  { latitude = -15, longitude = 167 }: { latitude?: number; longitude?: number } = {},
): Earthquake {
  return {
    id,
    source: 'emsc',
    magnitude,
    magnitudeType: 'mb',
    place: null,
    time: START + hours * HOUR_MS,
    depthKm: 10,
    longitude,
    latitude,
    url: '',
  };
}

function getRoles(earthquakes: readonly Earthquake[]) {
  return getSequences(earthquakes).map(({ main, members }) => ({
    main: main.id,
    members: members.map(({ earthquake, role }) => [earthquake.id, role]),
  }));
}

describe('sequence windows', () => {
  it('scales the distance and time windows with Magnitude', () => {
    expect(getDistanceWindowKm(4)).toBeCloseTo(30.1, 1);
    expect(getDistanceWindowKm(7)).toBeCloseTo(70.7, 1);
    expect(getTimeWindowMs(3) / (24 * HOUR_MS)).toBeCloseTo(11.9, 1);
    expect(getTimeWindowMs(7) / (24 * HOUR_MS)).toBeCloseTo(918.1, 1);
  });
});

describe('getSequences', () => {
  it('keeps a lone Earthquake as a sequence of one', () => {
    const lone = getQuake('lone', 5, 0);

    expect(getRoles([lone])).toEqual([{ main: 'lone', members: [['lone', 'main']] }]);
    expect(getSequenceBlurb(getSequenceOf(getSequences([lone]), lone), lone, 'en')).toBe(
      'No related Earthquakes nearby this week.',
    );
  });

  it('groups aftershocks under the largest Earthquake and leaves distant ones out', () => {
    const main = getQuake('main', 6.2, 0);
    const first = getQuake('first', 4.1, 2, { latitude: -15.1 });
    const second = getQuake('second', 3.8, 30, { longitude: 167.2 });
    const far = getQuake('far', 4, 5, { latitude: -20 });
    const sequences = getSequences([first, far, second, main]);

    expect(getRoles([first, far, second, main])).toEqual([
      {
        main: 'main',
        members: [
          ['main', 'main'],
          ['first', 'after'],
          ['second', 'after'],
        ],
      },
      { main: 'far', members: [['far', 'main']] },
    ]);
    expect(getSequenceBlurb(getSequenceOf(sequences, main), main, 'en')).toBe(
      'The largest of a group: 2 struck nearby this week.',
    );
    expect(getSequenceBlurb(getSequenceOf(sequences, first), first, 'en')).toBe(
      'Followed an M6.2 nearby on Thu 29.10.',
    );
  });

  it('marks a smaller Earthquake before the main shock as a foreshock', () => {
    const fore = getQuake('fore', 5.1, -6);
    const main = getQuake('main', 6.2, 0);
    const sequence = getSequenceOf(getSequences([main, fore]), fore);

    expect(sequence?.members.map(({ role }) => role)).toEqual(['fore', 'main']);
    expect(getSequenceBlurb(sequence, fore, 'en')).toBe(
      'Came before a bigger M6.2 nearby on Thu 29.10.',
    );
    expect(getSequenceBlurb(sequence, fore, 'es')).toBe(
      'Precedió a un M6,2 mayor cerca, el jue 29.10.',
    );
  });

  it('marks a later Earthquake within 0.05 of the main shock as a doublet', () => {
    const main = getQuake('main', 6.2, 0);
    const doublet = getQuake('doublet', 6.15, 20);
    const after = getQuake('after', 6.1, 40);
    const sequence = getSequenceOf(getSequences([after, doublet, main]), doublet);

    expect(sequence?.members.map(({ role }) => role)).toEqual(['main', 'doublet', 'after']);
    expect(getSequenceBlurb(sequence, doublet, 'en')).toBe(
      'Struck near an equally strong M6.2 from Thu 29.10.',
    );
  });

  it('makes the earlier of two equal Earthquakes the main shock', () => {
    const later = getQuake('later', 5, 10);
    const earlier = getQuake('earlier', 5, 0);

    expect(getRoles([later, earlier])).toEqual([
      {
        main: 'earlier',
        members: [
          ['earlier', 'main'],
          ['later', 'doublet'],
        ],
      },
    ]);
  });
});

describe('getSequenceRows', () => {
  const main = getQuake('main', 6.2, 0);
  const big = getQuake('big', 5.5, 1);
  const mid = getQuake('mid', 5, 2);
  const small = getQuake('small', 3, 3);
  const [sequence] = getSequences([small, mid, big, main]);

  it('lists the three largest when the selected one is among them', () => {
    expect(getSequenceRows(sequence, big).map(({ earthquake }) => earthquake.id)).toEqual([
      'main',
      'big',
      'mid',
    ]);
  });

  it('swaps the third row for the selected Earthquake when it is smaller', () => {
    const rows = getSequenceRows(sequence, small);

    expect(rows.map(({ earthquake }) => earthquake.id)).toEqual(['main', 'big', 'small']);
    expect(rows.map((row) => getSequenceRoleLabel(row, small, 'en'))).toEqual([
      'Largest',
      'After',
      'Selected',
    ]);
  });
});
