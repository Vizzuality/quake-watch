import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useRef } from 'react';

import { getRoundedCoordinate } from '@/lib/earthquakes/search-schema';

export const CAMERA_DEBOUNCE_MS = 300;

export type Camera = { lat: number; lon: number; zoom: number };

export function getWrappedLongitude(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

function getClamped(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function useCameraSearch() {
  const navigate = useNavigate({ from: '/' });
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const setCamera = useCallback(
    ({ lat, lon, zoom }: Camera) => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const camera = {
          lat: getRoundedCoordinate(getClamped(lat, -90, 90)),
          lon: getRoundedCoordinate(getWrappedLongitude(lon)),
          zoom: getRoundedCoordinate(getClamped(zoom, 0, 20)),
        };
        void navigate({ search: (prev) => ({ ...prev, ...camera }), replace: true });
      }, CAMERA_DEBOUNCE_MS);
    },
    [navigate],
  );

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return setCamera;
}
