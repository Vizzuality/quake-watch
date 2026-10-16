import { describe, expect, it } from 'vitest';

import { getOverlayFitPadding } from './fit-padding';

const MAP = { top: 0, bottom: 844 };

describe('getOverlayFitPadding', () => {
  it('keeps the fitted area clear of the header and the timeline', () => {
    expect(
      getOverlayFitPadding({
        map: MAP,
        top: { top: 12, bottom: 126 },
        bottom: { top: 655, bottom: 808 },
        gap: 24,
      }),
    ).toEqual({ top: 150, right: 24, bottom: 213, left: 24 });
  });

  it('falls back to the plain gap when an overlay is missing', () => {
    expect(getOverlayFitPadding({ map: MAP, top: null, bottom: null, gap: 24 })).toEqual({
      top: 24,
      right: 24,
      bottom: 24,
      left: 24,
    });
  });

  it('falls back to the plain gap when the overlays leave too little room', () => {
    expect(
      getOverlayFitPadding({
        map: { top: 0, bottom: 300 },
        top: { top: 0, bottom: 140 },
        bottom: { top: 160, bottom: 300 },
        gap: 24,
      }),
    ).toEqual({ top: 24, right: 24, bottom: 24, left: 24 });
  });
});
