import type { SearchArea } from '../earthquakes/search-area';
import { SEARCH_RADII_KM } from '../earthquakes/search-schema';
import { getMapZoom } from './map-handover';
import { type GlobeView, ZOOM_RANGE, getCenteredView } from './motion';
import { getSearchAreaAngle } from './search-area-ring';

const GLOBE_AREA_RADIUS_KM = SEARCH_RADII_KM[SEARCH_RADII_KM.length - 1];
const GLOBE_AREA_ZOOM = 3;

export function isAreaFramedOnMap({ radiusKm }: SearchArea): boolean {
  return radiusKm < GLOBE_AREA_RADIUS_KM;
}

function getAreaGlobeZoom(area: SearchArea): number {
  return isAreaFramedOnMap(area) ? ZOOM_RANGE[1] : GLOBE_AREA_ZOOM;
}

export function getAreaGlobeView(area: SearchArea, view: GlobeView): GlobeView {
  return { ...getCenteredView(area.latitude, area.longitude, view), zoom: getAreaGlobeZoom(area) };
}

export function getAreaMapZoom(area: SearchArea, radiusPx: number): number {
  return getMapZoom(radiusPx / getSearchAreaAngle(area), area.latitude);
}
