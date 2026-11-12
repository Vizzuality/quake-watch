const MAPLIBRE_TILE_SIZE = 512;

export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
export const MAP_PRELOAD_ZOOM = 4;
export const MAP_MERCATOR_ZOOM = 8;
export const MAP_FIELD_OF_VIEW = 0.5;

export function getMapZoom(radiusPx: number, latitude: number): number {
  const cos = Math.cos((latitude * Math.PI) / 180);
  return Math.log2((2 * Math.PI * radiusPx * cos) / MAPLIBRE_TILE_SIZE);
}

export function getMapPaddingTop(height: number, cy: number): number {
  return 2 * cy - height;
}

export function getMapProjection(globeZoom: number) {
  return {
    type: [
      'interpolate',
      ['linear'],
      ['zoom'],
      globeZoom,
      'vertical-perspective',
      MAP_MERCATOR_ZOOM,
      'mercator',
    ],
  };
}
