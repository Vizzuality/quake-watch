export const PHOTON_TYPES = ['country', 'state', 'county', 'city', 'district', 'locality'] as const;

export const PLACE_GROUPS = ['country', 'region', 'province', 'city', 'area'] as const;

export type PhotonType = (typeof PHOTON_TYPES)[number];
export type PlaceGroup = (typeof PLACE_GROUPS)[number];

const TYPE_GROUPS: Record<PhotonType, PlaceGroup> = {
  country: 'country',
  state: 'region',
  county: 'province',
  city: 'city',
  district: 'area',
  locality: 'area',
};

type GroupedPlace = { group: PlaceGroup; label: string };

export type PlaceOption<T extends GroupedPlace> = { place: T; index: number };

export type PlaceSection<T extends GroupedPlace> = {
  group: PlaceGroup;
  options: PlaceOption<T>[];
};

export function getPlaceGroup(type: PhotonType): PlaceGroup {
  return TYPE_GROUPS[type];
}

function getUniquePlaces<T extends GroupedPlace>(places: readonly T[], group: PlaceGroup): T[] {
  const labels = new Set<string>();
  return places.filter((place) => {
    if (place.group !== group || labels.has(place.label)) return false;
    labels.add(place.label);
    return true;
  });
}

export function getPlaceSections<T extends GroupedPlace>(places: readonly T[]): PlaceSection<T>[] {
  let index = 0;
  return PLACE_GROUPS.flatMap((group) => {
    const grouped = getUniquePlaces(places, group);
    if (grouped.length === 0) return [];
    const options = grouped.map((place) => ({ place, index: index++ }));
    return [{ group, options }];
  });
}

export function getSectionPlaces<T extends GroupedPlace>(sections: PlaceSection<T>[]): T[] {
  return sections.flatMap(({ options }) => options.map(({ place }) => place));
}
