import { describe, expect, it } from 'vitest';

import { MAP_IMAGE_PIXEL_RATIO, TOWN_ICON_ID, getMapImages } from './map-images';

describe('getMapImages', () => {
  it('ships only the town marker, with no dot patterns for land or sea', () => {
    expect(getMapImages().map(({ id }) => id)).toEqual([TOWN_ICON_ID]);
  });

  it('draws the town marker as a 4 px hollow primary ring at 2× pixel ratio', () => {
    const [town] = getMapImages();
    const getPixel = (x: number, y: number) => {
      const offset = (y * town.width + x) * 4;
      return Array.from(town.data.slice(offset, offset + 4));
    };

    expect(MAP_IMAGE_PIXEL_RATIO).toBe(2);
    expect([town.width, town.height]).toEqual([8, 8]);
    expect(getPixel(4, 1)).toEqual([230, 228, 245, 255]);
    expect(getPixel(3, 3)[3]).toBe(0);
  });
});
