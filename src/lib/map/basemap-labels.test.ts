import { describe, expect, it } from 'vitest';

import { getLocalizedNameField, isPlaceNameField } from './basemap-labels';

describe('getLocalizedNameField', () => {
  it('prefers the name in the UI language, then the latin name, then the local one', () => {
    expect(getLocalizedNameField('es')).toEqual([
      'coalesce',
      ['get', 'name:es'],
      ['get', 'name:latin'],
      ['get', 'name'],
    ]);
  });
});

describe('isPlaceNameField', () => {
  it('matches OpenFreeMap place-name fields', () => {
    expect(
      isPlaceNameField([
        'case',
        ['has', 'name:nonlatin'],
        ['concat', ['get', 'name:latin'], ' ', ['get', 'name:nonlatin']],
        ['coalesce', ['get', 'name_en'], ['get', 'name']],
      ]),
    ).toBe(true);
  });

  it('leaves road shields and empty fields alone', () => {
    expect(isPlaceNameField(['to-string', ['get', 'ref']])).toBe(false);
    expect(isPlaceNameField(undefined)).toBe(false);
  });
});
