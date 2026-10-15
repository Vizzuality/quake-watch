import { describe, expect, it } from 'vitest';

import { getEvaluatedNumber } from '@/test/evaluate-expression';

import { getPulseExpression } from './pulse-expression';
import { getPulse, getPulseLengthSeconds } from './wave';

describe('getPulseExpression', () => {
  it.each([0, 1.5, 4, 6.2, 10, 12])('matches getPulse over time for MMI %d', (mmi) => {
    const expression = getPulseExpression(['get', 'since'], ['get', 'mmi']);
    const length = getPulseLengthSeconds(mmi);
    for (const since of [-5, 0, 0.3, 1, 2.2, 3.1, length / 2, length - 0.1, length, length + 4]) {
      expect(getEvaluatedNumber(expression, { since, mmi })).toBeCloseTo(getPulse(since, mmi), 10);
    }
  });

  it('accepts literal inputs', () => {
    expect(getEvaluatedNumber(getPulseExpression(2, 5))).toBeCloseTo(getPulse(2, 5), 10);
  });
});
