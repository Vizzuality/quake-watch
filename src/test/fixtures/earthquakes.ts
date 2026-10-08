export function getEmscFeature(
  overrides: { id?: string; mag?: number; time?: string; region?: string | null } = {},
) {
  const id = overrides.id ?? '20260814_0000322';
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [-3.6316, 37.1147, -2.1] },
    properties: {
      unid: id,
      time: overrides.time ?? '2026-08-14T23:04:40.18Z',
      flynn_region: overrides.region === undefined ? 'SOUTHERN SPAIN' : overrides.region,
      lat: 37.1147,
      lon: -3.6316,
      depth: 2.1,
      mag: overrides.mag ?? 5.2,
      magtype: 'mb',
    },
  };
}

export function getUsgsFeature(
  overrides: { id?: string; mag?: number | null; time?: number; place?: string | null } = {},
) {
  const id = overrides.id ?? 'us6000tkv2';
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [-3.65, 37.13, 9.8] },
    properties: {
      mag: overrides.mag === undefined ? 5.2 : overrides.mag,
      magType: 'mww',
      place: overrides.place === undefined ? '1 km W of Alhendín, Spain' : overrides.place,
      time: overrides.time ?? 1_786_748_680_180,
      url: `https://earthquake.usgs.gov/earthquakes/eventpage/${id}`,
    },
  };
}

export function getFeatureCollection(features: unknown[]) {
  return { type: 'FeatureCollection', features };
}
