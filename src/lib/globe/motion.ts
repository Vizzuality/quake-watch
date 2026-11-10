export type GlobeView = { lon: number; lat: number; zoom: number };
export type GlobeVelocity = { lon: number; lat: number };

export const INITIAL_VIEW: GlobeView = { lon: (150 * Math.PI) / 180, lat: 0.12, zoom: 1 };
export const ZOOM_RANGE = [1, 5] as const;
export const LAT_LIMIT = 1.45;
const WHEEL_ZOOM_RATE = 0.0015;
const INERTIA_TIME_CONSTANT = 0.15;
const INERTIA_STOP_SPEED = 0.01;
const IDLE_DRIFT_SPEED = 0.0133;
const IDLE_DRIFT_PERIOD_MS = 9000;

export const STOPPED: GlobeVelocity = { lon: 0, lat: 0 };

function getClamped(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getClampedLat(lat: number): number {
  return getClamped(lat, -LAT_LIMIT, LAT_LIMIT);
}

export function getDraggedView(
  start: GlobeView,
  dxPx: number,
  dyPx: number,
  radiusPx: number,
): GlobeView {
  const k = 1 / (radiusPx * start.zoom);
  return { ...start, lon: start.lon - dxPx * k, lat: getClampedLat(start.lat + dyPx * k) };
}

export function getZoomedView(view: GlobeView, factor: number): GlobeView {
  return { ...view, zoom: getClamped(view.zoom * factor, ZOOM_RANGE[0], ZOOM_RANGE[1]) };
}

export function getWheelFactor(deltaY: number): number {
  return Math.exp(-deltaY * WHEEL_ZOOM_RATE);
}

export function getPinchFactor(distance: number, previousDistance: number): number {
  return distance / previousDistance;
}

export function getInertiaView(
  view: GlobeView,
  velocity: GlobeVelocity,
  dt: number,
): { view: GlobeView; velocity: GlobeVelocity } {
  const decay = Math.exp(-dt / INERTIA_TIME_CONSTANT);
  const travel = INERTIA_TIME_CONSTANT * (1 - decay);
  const next = { lon: velocity.lon * decay, lat: velocity.lat * decay };
  return {
    view: {
      ...view,
      lon: view.lon + velocity.lon * travel,
      lat: getClampedLat(view.lat + velocity.lat * travel),
    },
    velocity: Math.hypot(next.lon, next.lat) < INERTIA_STOP_SPEED ? STOPPED : next,
  };
}

export function getIdleDriftLon(lon: number, dtSeconds: number, elapsedMs: number): number {
  return lon + dtSeconds * IDLE_DRIFT_SPEED * Math.cos(elapsedMs / IDLE_DRIFT_PERIOD_MS);
}

export const FLY_DURATION_MS = 900;
export const SELECT_MIN_ZOOM = 1.6;
const FULL_TURN = 2 * Math.PI;

function getRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function getDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function getUnwrappedLon(longitude: number, referenceLon: number): number {
  const lon = getRadians(longitude);
  return lon + FULL_TURN * Math.round((referenceLon - lon) / FULL_TURN);
}

export function getCenteredView(latitude: number, longitude: number, view: GlobeView): GlobeView {
  return {
    lon: getUnwrappedLon(longitude, view.lon),
    lat: getClampedLat(getRadians(latitude)),
    zoom: getClamped(Math.max(view.zoom, SELECT_MIN_ZOOM), ZOOM_RANGE[0], ZOOM_RANGE[1]),
  };
}

export function getFramedView(longitude: number, view: GlobeView): GlobeView {
  return { lon: getUnwrappedLon(longitude, view.lon), lat: INITIAL_VIEW.lat, zoom: ZOOM_RANGE[0] };
}

export function getSearchView(lat: number, lon: number, zoom: number): GlobeView {
  return {
    lon: getRadians(lon),
    lat: getClampedLat(getRadians(lat)),
    zoom: getClamped(zoom, ZOOM_RANGE[0], ZOOM_RANGE[1]),
  };
}

export function getViewCamera(view: GlobeView): { lat: number; lon: number; zoom: number } {
  return { lat: getDegrees(view.lat), lon: getDegrees(view.lon), zoom: view.zoom };
}

function getEasedProgress(progress: number): number {
  const p = getClamped(progress, 0, 1);
  return p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
}

function getInterpolated(from: number, to: number, t: number): number {
  return from * (1 - t) + to * t;
}

export function getFlyView(from: GlobeView, to: GlobeView, progress: number): GlobeView {
  const t = getEasedProgress(progress);
  return {
    lon: getInterpolated(from.lon, to.lon, t),
    lat: getInterpolated(from.lat, to.lat, t),
    zoom: getInterpolated(from.zoom, to.zoom, t),
  };
}
