import { describe, expect, it } from 'vitest';

import { getBinDateFormat, getDateTimeFormat } from './timeline-format';

const time = Date.UTC(2026, 7, 14, 9, 5);

describe('timeline formats', () => {
  it('omits the time for daily bins', () => {
    expect(getBinDateFormat('day', 'en').format(time)).toMatch(/^Aug 14$/);
  });
  it('includes the time for hourly bins and date-times', () => {
    expect(getBinDateFormat('hour', 'en').format(time)).toMatch(/Aug 14.*\d{2}:\d{2}/);
    expect(getDateTimeFormat('es').format(time)).toMatch(/14.*\d{2}:\d{2}/);
  });
});
