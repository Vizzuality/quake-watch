import type { Map as MapLibreMap } from 'maplibre-gl';

const NEAR_Z_SCALE = 0.5;
const FAR_Z_SCALE = 100;

type CameraTransform = {
  cameraToCenterDistance: number;
  overrideNearFarZ(nearZ: number, farZ: number): void;
};

function getCameraTransform(map: MapLibreMap): CameraTransform | null {
  // The globe's fixed 0.5 px nearZ drops tile rows at a narrow field of view (https://github.com/maplibre/maplibre-gl-js/blob/v6.18.0/src/geo/projection/vertical_perspective_transform.ts#L325), and MapLibre 6 only reaches the transform through the private `_camera`: https://github.com/maplibre/maplibre-gl-js/issues/8184
  const transform = (map as unknown as { _camera?: { transform?: Partial<CameraTransform> } })
    ._camera?.transform;
  if (typeof transform?.overrideNearFarZ !== 'function') return null;
  if (typeof transform.cameraToCenterDistance !== 'number') return null;
  return transform as CameraTransform;
}

export function setMapNearFarZ(map: MapLibreMap) {
  const transform = getCameraTransform(map);
  if (!transform) return;
  const distance = transform.cameraToCenterDistance;
  transform.overrideNearFarZ(distance * NEAR_Z_SCALE, distance * FAR_Z_SCALE);
}
