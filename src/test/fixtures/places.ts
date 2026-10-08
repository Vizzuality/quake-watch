export function getPhotonCollection(names: string[] = ['Granada']) {
  return {
    type: 'FeatureCollection',
    features: names.map((name, index) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-3.5986 + index, 37.1773] },
      properties: {
        osm_type: 'R',
        osm_id: 344685 + index,
        name,
        state: 'Andalucía',
        country: 'España',
      },
    })),
  };
}
