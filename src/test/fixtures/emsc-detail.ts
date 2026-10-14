export function getEmscDetailFeature(
  overrides: { id?: string; depth?: number; lastupdate?: string | null } = {},
) {
  const id = overrides.id ?? '20261013_0000326';
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [152.1142, -5.4162, -28.4] },
    id,
    properties: {
      source_id: '2074230',
      source_catalog: 'EMSC-RTS',
      lastupdate:
        overrides.lastupdate === undefined ? '2026-10-13T16:58:41.956411Z' : overrides.lastupdate,
      time: '2026-10-13T16:28:14.303Z',
      flynn_region: 'NEW BRITAIN REGION, P.N.G.',
      lat: -5.4162,
      lon: 152.1142,
      depth: overrides.depth ?? 28.4,
      evtype: 'ke',
      auth: 'NEIC',
      mag: 5.1,
      magtype: 'mb',
      unid: id,
    },
  };
}
