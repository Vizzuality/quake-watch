import { describe, expect, it } from 'vitest';

import { getDepthScale } from './depth-scale';
import {
  getDepthTickLabel,
  getSectionAlt,
  getSectionBlurb,
  getSectionFootnote,
  getSectionHypocentreLabel,
} from './section-labels';

describe('section labels', () => {
  it('labels the depth axis from sea level down', () => {
    expect(getDepthTickLabel(0, 'en')).toBe('SEA LEVEL');
    expect(getDepthTickLabel(100, 'en')).toBe('100 KM');
    expect(getDepthTickLabel(0, 'pt')).toBe('NÍVEL DO MAR');
  });

  it('names the hypocentre by magnitude and depth', () => {
    expect(getSectionHypocentreLabel(4.7, 10, 'en')).toBe('M4.7 · 10 KM');
    expect(getSectionHypocentreLabel(6.25, 143.4, 'es')).toBe('M6,3 · 143 KM');
  });

  it('states both stretch factors in the footnote', () => {
    expect(getSectionFootnote(getDepthScale(10).stretch, 'en')).toBe(
      '900 KM SLICE THROUGH THIS EARTHQUAKE, WEST → EAST · TOP 10 KM STRETCHED ×9 · BELOW ×1.2',
    );
  });

  it('cites Slab2 only when the slice crosses a sinking plate', () => {
    expect(getSectionBlurb('usgs', true, 'en')).toContain('USGS Slab2, earthquakes from USGS.');
    expect(getSectionBlurb('emsc', false, 'en')).not.toContain('Slab2');
    expect(getSectionBlurb('emsc', false, 'en')).toContain('earthquakes from EMSC.');
  });

  it('describes the slice for people who cannot see it', () => {
    const alt = getSectionAlt(
      {
        depthKm: 10,
        facts: {
          layer: 'upper',
          surfaceElevationM: -2400,
          crustThicknessKm: 18.4,
          slabDepthKm: 32,
        },
        hasSlab: true,
        otherCount: 26,
      },
      'en',
    );

    expect(alt).toBe(
      'Cross-section 900 km long, west to east, through this earthquake, which started 10 km down in the upper crust. ' +
        'The sea floor above it lies 2.4 km below sea level. ' +
        'The crust there is 18 km thick. ' +
        'The top of the sinking plate lies 32 km below the epicentre. ' +
        '26 other earthquakes lie within 100 km of the slice.',
    );
  });

  it('describes land, a plate away from the epicentre and a single neighbour', () => {
    const alt = getSectionAlt(
      {
        depthKm: 5,
        facts: {
          layer: 'sediments',
          surfaceElevationM: 1234,
          crustThicknessKm: 30,
          slabDepthKm: null,
        },
        hasSlab: true,
        otherCount: 1,
      },
      'en',
    );

    expect(alt).toContain('The ground above it is 1.2 km above sea level.');
    expect(alt).toContain('A sinking plate crosses the slice, but not under the epicentre.');
    expect(alt).toContain('1 other earthquake lies within 100 km of the slice.');
  });

  it('says when no plate is mapped and leaves out an empty neighbourhood', () => {
    const alt = getSectionAlt(
      {
        depthKm: 5,
        facts: { layer: 'mantle', surfaceElevationM: 0, crustThicknessKm: 7, slabDepthKm: null },
        hasSlab: false,
        otherCount: 0,
      },
      'en',
    );

    expect(alt).toContain('No sinking plate is mapped along this slice.');
    expect(alt).not.toContain('other earthquake');
  });
});
