import type { Map as MapLibreMap } from 'maplibre-gl';
import { describe, expect, it, vi } from 'vitest';

import { setMapNearFarZ } from './map-near-far';

function getFakeMap(camera: unknown): MapLibreMap {
  return { _camera: camera } as unknown as MapLibreMap;
}

describe('setMapNearFarZ', () => {
  it('pins near and far to half and a hundred times the camera distance', () => {
    const overrideNearFarZ = vi.fn<(nearZ: number, farZ: number) => void>();

    setMapNearFarZ(getFakeMap({ transform: { cameraToCenterDistance: 1000, overrideNearFarZ } }));

    expect(overrideNearFarZ).toHaveBeenCalledExactlyOnceWith(500, 100_000);
  });

  it.each([
    ['no camera', undefined],
    ['no transform', {}],
    ['no overrideNearFarZ', { transform: { cameraToCenterDistance: 1000 } }],
    ['no camera distance', { transform: { overrideNearFarZ: () => {} } }],
  ])('does nothing when MapLibre exposes %s', (_label, camera) => {
    expect(() => setMapNearFarZ(getFakeMap(camera))).not.toThrow();
  });

  it('leaves the transform alone when the camera distance is missing', () => {
    const overrideNearFarZ = vi.fn<(nearZ: number, farZ: number) => void>();

    setMapNearFarZ(getFakeMap({ transform: { overrideNearFarZ } }));

    expect(overrideNearFarZ).not.toHaveBeenCalled();
  });
});
