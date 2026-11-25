import type { MapPadding } from './map-overlay';
import { ZOOM_RANGE } from './motion';

const MAPLIBRE_TILE_SIZE = 512;

export const MAP_ZOOM_SPAN = 15;
export const MAP_MERCATOR_ZOOM = 8;
export const MAP_FIELD_OF_VIEW = 0.5;
const MAP_FADE_ZOOM = [4.5, 5] as const;

export function getMapZoom(radiusPx: number, latitude: number): number {
  const cos = Math.cos((latitude * Math.PI) / 180);
  return Math.log2((2 * Math.PI * radiusPx * cos) / MAPLIBRE_TILE_SIZE);
}

function getAxisPadding(size: number, centre: number): [number, number] {
  const offset = 2 * centre - size;
  return [Math.max(0, offset), Math.max(0, -offset)];
}

export function getMapHandoverPadding(
  width: number,
  height: number,
  centre: { cx: number; cy: number },
): MapPadding {
  const [top, bottom] = getAxisPadding(height, centre.cy);
  const [left, right] = getAxisPadding(width, centre.cx);
  return { top, bottom, left, right };
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

export function getUrlZoom(mapZoom: number, handoverZoom: number): number {
  return ZOOM_RANGE[1] + mapZoom - handoverZoom;
}

export function getMapZoomFromUrl(urlZoom: number, handoverZoom: number): number {
  return handoverZoom + Math.max(0, urlZoom - ZOOM_RANGE[1]);
}

export function getMapFade(globeZoom: number): number {
  const [start, end] = MAP_FADE_ZOOM;
  return Math.min(1, Math.max(0, (globeZoom - start) / (end - start)));
}
