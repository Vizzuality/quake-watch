import { describe, expect, it } from 'vitest';

import { LABEL_OBSTACLE_ICON_ID, LABEL_OBSTACLE_ICON_PX } from './label-obstacles';
import { MAP_IMAGE_PIXEL_RATIO, TOWN_ICON_ID, getMapImages } from './map-images';

describe('getMapImages', () => {
  it('ships the town marker and the chrome blocker, with no dot patterns for land or sea', () => {
    expect(getMapImages().map(({ id }) => id)).toEqual([TOWN_ICON_ID, LABEL_OBSTACLE_ICON_ID]);
  });

  it('draws the chrome blocker as a fully transparent 16 px square', () => {
    const blocker = getMapImages()[1];

    expect(blocker.width / MAP_IMAGE_PIXEL_RATIO).toBe(LABEL_OBSTACLE_ICON_PX);
    expect(blocker.height).toBe(blocker.width);
    expect(blocker.data.every((value) => value === 0)).toBe(true);
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
