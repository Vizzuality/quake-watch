import { describe, expect, it } from 'vitest';

import { type PlaceGroup, getPlaceGroup, getPlaceSections, getSectionPlaces } from './place-groups';

function getPlace(label: string, group: PlaceGroup) {
  return { id: `${group}:${label}`, label, group };
}

describe('getPlaceGroup', () => {
  it.each([
    ['country', 'country'],
    ['state', 'region'],
    ['county', 'province'],
    ['city', 'city'],
    ['district', 'area'],
    ['locality', 'area'],
  ] as const)('maps %s to %s', (type, group) => {
    expect(getPlaceGroup(type)).toBe(group);
  });
});

describe('getPlaceSections', () => {
  it('orders the groups from country to area and keeps the ranking inside a group', () => {
    const sections = getPlaceSections([
      getPlace('Granada, Andalucía, España', 'city'),
      getPlace('Granada, Andalucía, España', 'province'),
      getPlace('Granada, Antioquia, Colombia', 'city'),
      getPlace('Granada, Nicaragua', 'region'),
      getPlace('Granada, Granada, Nicaragua', 'area'),
    ]);

    expect(sections.map(({ group }) => group)).toEqual(['region', 'province', 'city', 'area']);
    expect(sections[2]?.options.map(({ place }) => place.label)).toEqual([
      'Granada, Andalucía, España',
      'Granada, Antioquia, Colombia',
    ]);
  });

  it('numbers the options across groups in display order', () => {
    const sections = getPlaceSections([
      getPlace('Tokyo', 'city'),
      getPlace('Japan', 'country'),
      getPlace('Shibuya', 'area'),
    ]);

    expect(sections.flatMap(({ options }) => options.map(({ index }) => index))).toEqual([0, 1, 2]);
    expect(getSectionPlaces(sections).map(({ label }) => label)).toEqual([
      'Japan',
      'Tokyo',
      'Shibuya',
    ]);
  });

  it('drops a repeated label inside a group but keeps it in another group', () => {
    const sections = getPlaceSections([
      getPlace('Granada, Andalucía, España', 'city'),
      getPlace('Granada, Andalucía, España', 'province'),
      getPlace('Granada, Andalucía, España', 'city'),
    ]);

    expect(
      sections.map(({ group, options }) => [group, options.map(({ place }) => place.id)]),
    ).toEqual([
      ['province', ['province:Granada, Andalucía, España']],
      ['city', ['city:Granada, Andalucía, España']],
    ]);
  });

  it('has no sections without places', () => {
    expect(getPlaceSections([])).toEqual([]);
  });
});
