import 'maplibre-gl/dist/maplibre-gl.css';
import latinRegular from '@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff2?url';
import latinExtRegular from '@fontsource/space-grotesk/files/space-grotesk-latin-ext-400-normal.woff2?url';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import {
  type GeoJSONSource,
  Map as MapLibreMap,
  type MapMouseEvent,
  type ProjectionSpecification,
  setWorkerUrl,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { type RefObject, useEffect, useId, useRef } from 'react';

import { getWrappedLongitude, useCameraSearch } from '@/hooks/use-camera-search';
import { getDepthColor } from '@/lib/earthquakes/depth-color';
import { getFeltReachKm } from '@/lib/earthquakes/intensity';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getMinRingRadiusPx, isFeltRingShown } from '@/lib/globe/felt-rings';
import { getGlobeFrame } from '@/lib/globe/frame';
import { getFeltRing, getFeltRingBounds } from '@/lib/globe/map-felt-rings';
import {
  MAP_FIELD_OF_VIEW,
  MAP_ZOOM_SPAN,
  getMapFade,
  getMapPaddingTop,
  getMapProjection,
  getMapZoom,
  getMapZoomFromUrl,
  getUrlZoom,
} from '@/lib/globe/map-handover';
import {
  FELT_SOURCE_ID,
  MAP_ATTRIBUTION,
  MAP_COLORS,
  MAP_STYLE_URL,
  QUAKE_LAYER_ID,
  QUAKE_SOURCE_ID,
  getStreetMapStyle,
} from '@/lib/globe/map-style';
import { type GlobeView, ZOOM_RANGE, getViewCamera } from '@/lib/globe/motion';
import { PICK_TOLERANCE_PX, getPickedQuakeIndex } from '@/lib/globe/picking';
import { getEpicentreRadiusPx } from '@/lib/globe/quakes';

import { QuakeTooltip } from './quake-tooltip';
import type { GlobeControls } from './use-globe-controls';
import {
  getQuakeKey,
  getSelectedEarthquake,
  listenForTooltipEscape,
  useHoveredQuake,
} from './use-hovered-quake';

export type MapCentre = { lat: number; lon: number };
export type MapHandover = {
  activate: (urlZoom?: number) => boolean;
  centre: (earthquake: Earthquake) => void;
  focus: (earthquake: Earthquake) => void;
};

type GlobeMapProps = {
  controls: GlobeControls;
  globeRef: RefObject<HTMLElement | null>;
  layerRef: RefObject<HTMLDivElement | null>;
  handoverRef: RefObject<MapHandover | null>;
  onReady: () => void;
  onExit: (centre: MapCentre) => void;
};

declare global {
  interface Window {
    __globeMap?: MapLibreMap;
  }
}

const EXIT_ZOOM_TOLERANCE = 0.01;
const FOCUS_PADDING_PX = 48;
const FOCUS_URL_ZOOM = 7;
const EMPTY_EARTHQUAKES: readonly Earthquake[] = [];
const FONT_URLS = { latin: latinRegular, latinExt: latinExtRegular };
const homeRoute = getRouteApi('/');

setWorkerUrl(workerUrl);

function getTouchDistance(touches: TouchList): number {
  return Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY,
  );
}

function isFeltShown(earthquake: Earthquake, selected: Earthquake | undefined): boolean {
  return getFeltReachKm(earthquake) > 0 && isFeltRingShown(earthquake, selected);
}

function getQuakeFeatures(earthquakes: readonly Earthquake[], selected: Earthquake | undefined) {
  return {
    type: 'FeatureCollection' as const,
    features: earthquakes.map((earthquake) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [earthquake.longitude, earthquake.latitude],
      },
      properties: {
        key: getQuakeKey(earthquake),
        color: getDepthColor(earthquake.depthKm),
        radius: getEpicentreRadiusPx(earthquake.magnitude),
        ringRadius: getMinRingRadiusPx(earthquake.magnitude),
        isFelt: isFeltShown(earthquake, selected),
      },
    })),
  };
}

function getFeltFeatures(earthquakes: readonly Earthquake[], selected: Earthquake | undefined) {
  return {
    type: 'FeatureCollection' as const,
    features: earthquakes.flatMap((earthquake) => {
      if (!isFeltShown(earthquake, selected)) return [];
      const reachKm = getFeltReachKm(earthquake);
      const { polygon, outline } = getFeltRing(earthquake.latitude, earthquake.longitude, reachKm);
      const properties = { color: getDepthColor(earthquake.depthKm) };
      return [
        {
          type: 'Feature' as const,
          geometry: { type: 'Polygon' as const, coordinates: polygon },
          properties,
        },
        {
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: outline },
          properties,
        },
      ];
    }),
  };
}

function setQuakeData(
  map: MapLibreMap,
  earthquakes: readonly Earthquake[],
  selected: Earthquake | undefined,
) {
  map.getSource<GeoJSONSource>(QUAKE_SOURCE_ID)?.setData(getQuakeFeatures(earthquakes, selected));
  map.getSource<GeoJSONSource>(FELT_SOURCE_ID)?.setData(getFeltFeatures(earthquakes, selected));
}

function getPointedEarthquake(
  map: MapLibreMap,
  earthquakes: readonly Earthquake[],
  { point }: MapMouseEvent,
): Earthquake | null {
  const features = map.queryRenderedFeatures(
    [
      [point.x - PICK_TOLERANCE_PX, point.y - PICK_TOLERANCE_PX],
      [point.x + PICK_TOLERANCE_PX, point.y + PICK_TOLERANCE_PX],
    ],
    { layers: [QUAKE_LAYER_ID] },
  );
  const keys = new Set(features.map((feature) => feature.properties.key));
  const candidates = earthquakes.filter((earthquake) => keys.has(getQuakeKey(earthquake)));
  const points = candidates.map((earthquake, index) => ({
    index,
    ...map.project([earthquake.longitude, earthquake.latitude]),
  }));
  const index = getPickedQuakeIndex(points, point.x, point.y);
  if (index === null) return null;
  return candidates[index];
}

function getCursor(earthquake: Earthquake | null): string {
  return earthquake ? 'pointer' : '';
}

function getMapOpacity(isReady: boolean, isActive: boolean, globeZoom: number): number {
  if (!isReady) return 0;
  if (isActive) return 1;
  return getMapFade(globeZoom);
}

export default function GlobeMap({
  controls,
  globeRef,
  layerRef,
  handoverRef,
  onReady,
  onExit,
}: GlobeMapProps) {
  const search = homeRoute.useSearch();
  const navigate = homeRoute.useNavigate();
  const { data } = useQuery(earthquakesQueryOptions(getEarthquakeFilters(search)));
  const setCamera = useCameraSearch();
  const { hovered, show, scheduleHide, hide, enterTooltip, leaveTooltip } = useHoveredQuake();
  const tooltipId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const earthquakes = data?.earthquakes ?? EMPTY_EARTHQUAKES;
  const earthquakesRef = useRef(earthquakes);
  const selectedEarthquake = getSelectedEarthquake(earthquakes, search.quake);
  const selectedRef = useRef(selectedEarthquake);
  const variant = search.quake === undefined ? 'full' : 'compact';
  const callbacksRef = useRef({
    onReady,
    onExit,
    onHover: handleHover,
    onSelect: selectQuake,
    onMove: setCamera,
  });

  function selectQuake(earthquake: Earthquake) {
    hide();
    mapRef.current?.easeTo({ center: [earthquake.longitude, earthquake.latitude] });
    const key = getQuakeKey(earthquake);
    if (key === search.quake) return;
    void navigate({ search: (prev) => ({ ...prev, quake: key }) });
  }

  function handleHover(earthquake: Earthquake | null) {
    const map = mapRef.current;
    if (!map || !earthquake) {
      scheduleHide();
      return;
    }
    const container = map.getContainer();
    const { x, y } = map.project([earthquake.longitude, earthquake.latitude]);
    show({
      earthquake,
      now: Date.now(),
      anchor: { x, y },
      containerSize: { width: container.clientWidth, height: container.clientHeight },
    });
  }

  useEffect(() => {
    callbacksRef.current = {
      onReady,
      onExit,
      onHover: handleHover,
      onSelect: selectQuake,
      onMove: setCamera,
    };
    earthquakesRef.current = earthquakes;
    selectedRef.current = selectedEarthquake;
  });

  useEffect(() => {
    if (mapRef.current) setQuakeData(mapRef.current, earthquakes, selectedEarthquake);
  }, [earthquakes, selectedEarthquake]);

  useEffect(() => {
    if (!hovered) return;
    return listenForTooltipEscape(hide);
  }, [hovered, hide]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const element: HTMLElement = container;
    const layer = layerRef.current;
    const globe = globeRef.current;
    const map = new MapLibreMap({
      container: element,
      style: MAP_STYLE_URL,
      transformStyle: (_previous, next) => getStreetMapStyle(next, FONT_URLS),
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      // Overrides the default 4, which fetches tiles past a source's maxzoom and defeats the z0 underlay: https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/#zoomlevelstooverscale
      zoomLevelsToOverscale: undefined,
      attributionControl: { compact: true, customAttribution: MAP_ATTRIBUTION },
    });
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.setVerticalFieldOfView(MAP_FIELD_OF_VIEW);
    let isStyleLoaded = false;
    let isReady = false;
    let isActive = false;
    let hasExited = false;
    let pinchDistance: number | null = null;
    let isSwallowingTouch = false;

    function getRadius(globeZoom: number): number {
      return getGlobeFrame(element.clientWidth, element.clientHeight).radius * globeZoom;
    }

    function getMinZoom(): number {
      return getMapZoom(getRadius(ZOOM_RANGE[1]), map.getCenter().lat);
    }

    function setOpacity(view: GlobeView) {
      const opacity = getMapOpacity(isReady, isActive, view.zoom);
      if (layer) layer.style.opacity = String(opacity);
      if (globe) globe.style.opacity = String(1 - opacity);
    }

    function setInput(isMapInput: boolean) {
      if (layer) {
        layer.inert = !isMapInput;
        layer.style.pointerEvents = isMapInput ? 'auto' : 'none';
      }
      if (globe) globe.style.pointerEvents = isMapInput ? 'none' : '';
    }

    function sync(view: GlobeView) {
      if (isActive) return;
      const { lat, lon } = getViewCamera(view);
      const frame = getGlobeFrame(element.clientWidth, element.clientHeight);
      map.setPadding({ top: getMapPaddingTop(element.clientHeight, frame.cy) });
      map.jumpTo({
        center: [getWrappedLongitude(lon), lat],
        zoom: getMapZoom(getRadius(view.zoom), lat),
      });
      if (isStyleLoaded) map.redraw();
      setOpacity(view);
    }

    function updateZoomRange() {
      const minZoom = getMinZoom();
      map.setMaxZoom(minZoom + MAP_ZOOM_SPAN);
      map.setMinZoom(minZoom);
    }

    function activate(urlZoom?: number): boolean {
      if (!isReady) return false;
      sync(controls.viewRef.current);
      isActive = true;
      hasExited = false;
      pinchDistance = null;
      isSwallowingTouch = false;
      updateZoomRange();
      if (urlZoom !== undefined) map.jumpTo({ zoom: getMapZoomFromUrl(urlZoom, getMinZoom()) });
      setInput(true);
      setOpacity(controls.viewRef.current);
      return true;
    }

    function centre({ latitude, longitude }: Earthquake) {
      map.easeTo({ center: [longitude, latitude] });
    }

    function focus(earthquake: Earthquake) {
      const { latitude, longitude } = earthquake;
      const reachKm = getFeltReachKm(earthquake);
      if (!(reachKm > 0)) {
        map.easeTo({
          center: [longitude, latitude],
          zoom: getMapZoomFromUrl(FOCUS_URL_ZOOM, getMinZoom()),
        });
        return;
      }
      const { outline, hasPole } = getFeltRing(latitude, longitude, reachKm);
      if (hasPole) {
        map.easeTo({ center: [longitude, latitude], zoom: getMinZoom() });
        return;
      }
      map.fitBounds(getFeltRingBounds(outline), { padding: FOCUS_PADDING_PX });
    }

    function exit() {
      if (hasExited) return;
      hasExited = true;
      isActive = false;
      map.setMinZoom(null);
      setInput(false);
      const { lat, lng } = map.getCenter();
      callbacksRef.current.onExit({ lat, lon: lng });
    }

    function isAtMinZoom(): boolean {
      return isActive && map.getZoom() <= getMinZoom() + EXIT_ZOOM_TOLERANCE;
    }

    function handleStyleLoad() {
      isStyleLoaded = true;
      map.setProjection(
        getMapProjection(getMapZoom(getRadius(ZOOM_RANGE[1]), 0)) as ProjectionSpecification,
      );
      setQuakeData(map, earthquakesRef.current, selectedRef.current);
      sync(controls.viewRef.current);
      map.once('idle', () => {
        isReady = true;
        setOpacity(controls.viewRef.current);
        callbacksRef.current.onReady();
      });
    }

    function handleMoveStart() {
      if (isActive) callbacksRef.current.onHover(null);
    }

    function handleMoveEnd() {
      if (!isActive) return;
      updateZoomRange();
      const { lat, lng } = map.getCenter();
      callbacksRef.current.onMove({
        lat,
        lon: lng,
        zoom: getUrlZoom(map.getZoom(), getMinZoom()),
      });
    }

    function swallow(event: Event) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    function handleWheel(event: WheelEvent) {
      if (!isActive) {
        swallow(event);
        return;
      }
      if (event.deltaY <= 0 || !isAtMinZoom()) return;
      swallow(event);
      exit();
    }

    function handleTouchMove(event: TouchEvent) {
      if (isSwallowingTouch) {
        swallow(event);
        return;
      }
      if (event.touches.length !== 2) {
        pinchDistance = null;
        return;
      }
      const distance = getTouchDistance(event.touches);
      const isPinchOut = pinchDistance !== null && distance < pinchDistance;
      pinchDistance = distance;
      if (!isPinchOut || !isAtMinZoom()) return;
      swallow(event);
      isSwallowingTouch = true;
      exit();
    }

    function handleTouchEnd(event: TouchEvent) {
      if (event.touches.length > 0) return;
      isSwallowingTouch = false;
      pinchDistance = null;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const isZoomOut = event.key === '-' || event.key === '_';
      if (!isZoomOut || !isAtMinZoom()) return;
      swallow(event);
      exit();
    }

    function handlePointerMove(event: MapMouseEvent) {
      const earthquake = getPointedEarthquake(map, earthquakesRef.current, event);
      map.getCanvas().style.cursor = getCursor(earthquake);
      callbacksRef.current.onHover(earthquake);
    }

    function handlePointerOut() {
      map.getCanvas().style.cursor = '';
      callbacksRef.current.onHover(null);
    }

    function handleClick(event: MapMouseEvent) {
      const earthquake = getPointedEarthquake(map, earthquakesRef.current, event);
      if (earthquake) callbacksRef.current.onSelect(earthquake);
    }

    sync(controls.viewRef.current);
    controls.setFrameListener(sync);
    handoverRef.current = { activate, centre, focus };
    map.once('style.load', handleStyleLoad);
    map.on('movestart', handleMoveStart);
    map.on('moveend', handleMoveEnd);
    map.on('mousemove', handlePointerMove);
    map.on('mouseout', handlePointerOut);
    map.on('click', handleClick);
    element.addEventListener('wheel', handleWheel, { capture: true });
    element.addEventListener('touchmove', handleTouchMove, { capture: true });
    element.addEventListener('touchend', handleTouchEnd, { capture: true });
    element.addEventListener('touchcancel', handleTouchEnd, { capture: true });
    element.addEventListener('keydown', handleKeyDown, { capture: true });
    if (import.meta.env.DEV) window.__globeMap = map;
    return () => {
      controls.setFrameListener(null);
      handoverRef.current = null;
      setInput(false);
      if (globe) globe.style.opacity = '';
      element.removeEventListener('wheel', handleWheel, { capture: true });
      element.removeEventListener('touchmove', handleTouchMove, { capture: true });
      element.removeEventListener('touchend', handleTouchEnd, { capture: true });
      element.removeEventListener('touchcancel', handleTouchEnd, { capture: true });
      element.removeEventListener('keydown', handleKeyDown, { capture: true });
      if (window.__globeMap === map) delete window.__globeMap;
      mapRef.current = null;
      map.remove();
    };
  }, [controls, globeRef, layerRef, handoverRef]);

  return (
    <>
      <div
        ref={containerRef}
        className="size-full"
        style={{ backgroundColor: MAP_COLORS.background }}
      />
      {hovered && (
        <QuakeTooltip
          id={tooltipId}
          earthquake={hovered.earthquake}
          now={hovered.now}
          variant={variant}
          anchor={hovered.anchor}
          containerSize={hovered.containerSize}
          onOpen={() => selectQuake(hovered.earthquake)}
          onPointerEnter={enterTooltip}
          onPointerLeave={leaveTooltip}
        />
      )}
    </>
  );
}
