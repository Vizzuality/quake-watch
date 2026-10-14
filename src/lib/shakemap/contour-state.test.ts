import { describe, expect, it } from 'vitest';

import { syncPassedSegments } from './contour-state';

function getFakeMap() {
  const states = new Map<number, boolean>();
  const calls: number[] = [];
  return {
    states,
    calls,
    setFeatureState({ id }: { source: string; id: number }, { passed }: { passed: boolean }) {
      calls.push(id);
      states.set(id, passed);
    },
  };
}

describe('syncPassedSegments', () => {
  it('marks only the newly passed segments when the S wave moves forward', () => {
    const map = getFakeMap();
    syncPassedSegments(map, 'contours', 0, 3);
    syncPassedSegments(map, 'contours', 3, 5);
    expect(map.calls).toEqual([0, 1, 2, 3, 4]);
    expect([...map.states.values()].every(Boolean)).toBe(true);
  });

  it('un-passes the segments beyond the S wave when seeking backwards', () => {
    const map = getFakeMap();
    syncPassedSegments(map, 'contours', 0, 5);
    syncPassedSegments(map, 'contours', 5, 2);
    expect(Object.fromEntries(map.states)).toEqual({
      0: true,
      1: true,
      2: false,
      3: false,
      4: false,
    });
  });

  it('does nothing when the count is unchanged', () => {
    const map = getFakeMap();
    syncPassedSegments(map, 'contours', 4, 4);
    expect(map.calls).toHaveLength(0);
  });
});
