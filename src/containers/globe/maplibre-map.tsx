import 'maplibre-gl/dist/maplibre-gl.css';
import { Map as MapLibreMap, type ProjectionSpecification, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useEffect, useRef } from 'react';

import { getGlobeFrame } from '@/lib/globe/frame';
import {
  MAP_FIELD_OF_VIEW,
  MAP_STYLE_URL,
  getMapPaddingTop,
  getMapProjection,
  getMapZoom,
} from '@/lib/globe/map-handover';
import { ZOOM_RANGE } from '@/lib/globe/motion';

export type MapCentre = { lat: number; lon: number };

type GlobeMapProps = {
  centre: MapCentre;
  onReady: () => void;
  onExit: (centre: MapCentre) => void;
};

declare global {
  interface Window {
    __globeMap?: MapLibreMap;
  }
}

const EXIT_ZOOM_TOLERANCE = 0.01;

setWorkerUrl(workerUrl);

function getGlobeRadius(container: HTMLElement): number {
  return getGlobeFrame(container.clientWidth, container.clientHeight).radius * ZOOM_RANGE[1];
}

function getTouchDistance(touches: TouchList): number {
  return Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY,
  );
}

export default function GlobeMap({ centre, onReady, onExit }: GlobeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onReady, onExit });
  const initialCentreRef = useRef(centre);

  useEffect(() => {
    callbacksRef.current = { onReady, onExit };
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const element: HTMLElement = container;
    const { lat, lon } = initialCentreRef.current;
    const radius = getGlobeRadius(element);
    const frame = getGlobeFrame(element.clientWidth, element.clientHeight);
    const map = new MapLibreMap({
      container: element,
      style: MAP_STYLE_URL,
      center: [lon, lat],
      zoom: getMapZoom(radius, lat),
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: { compact: true },
    });
    map.touchZoomRotate.disableRotation();
    map.setPadding({ top: getMapPaddingTop(element.clientHeight, frame.cy) });
    map.setVerticalFieldOfView(MAP_FIELD_OF_VIEW);
    let hasExited = false;
    let isReady = false;
    let pinchDistance: number | null = null;

    function getMinZoom(): number {
      return getMapZoom(getGlobeRadius(element), map.getCenter().lat);
    }

    function exit() {
      if (hasExited) return;
      hasExited = true;
      const { lat: centreLat, lng } = map.getCenter();
      callbacksRef.current.onExit({ lat: centreLat, lon: lng });
    }

    function isAtMinZoom(): boolean {
      return map.getZoom() <= getMinZoom() + EXIT_ZOOM_TOLERANCE;
    }

    function handleStyleLoad() {
      map.setProjection(getMapProjection(getMapZoom(radius, 0)) as ProjectionSpecification);
      map.setMinZoom(getMinZoom());
      map.jumpTo({ center: [lon, lat], zoom: getMapZoom(radius, lat) });
      map.once('idle', () => {
        isReady = true;
        callbacksRef.current.onReady();
      });
    }

    function handleMove() {
      map.setMinZoom(getMinZoom());
    }

    function handleWheel(event: WheelEvent) {
      if (event.deltaY > 0 && isAtMinZoom()) exit();
    }

    function handleTouchMove(event: TouchEvent) {
      if (event.touches.length !== 2) {
        pinchDistance = null;
        return;
      }
      const distance = getTouchDistance(event.touches);
      if (pinchDistance !== null && distance < pinchDistance && isAtMinZoom()) exit();
      pinchDistance = distance;
    }

    function handleError() {
      if (!isReady) exit();
    }

    map.once('style.load', handleStyleLoad);
    map.on('error', handleError);
    map.on('moveend', handleMove);
    element.addEventListener('wheel', handleWheel, { capture: true });
    element.addEventListener('touchmove', handleTouchMove, { capture: true });
    if (import.meta.env.DEV) window.__globeMap = map;
    return () => {
      element.removeEventListener('wheel', handleWheel, { capture: true });
      element.removeEventListener('touchmove', handleTouchMove, { capture: true });
      if (window.__globeMap === map) delete window.__globeMap;
      map.remove();
    };
  }, []);

  return <div ref={containerRef} className="size-full" />;
}
