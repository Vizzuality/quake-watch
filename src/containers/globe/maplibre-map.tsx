import 'maplibre-gl/dist/maplibre-gl.css';
import latinRegular from '@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff2?url';
import latinExtRegular from '@fontsource/space-grotesk/files/space-grotesk-latin-ext-400-normal.woff2?url';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import {
  type GeoJSONSource,
  Map as MapLibreMap,
  type MapLayerMouseEvent,
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
  getQuakeMapRadiusPx,
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

import { QuakeTooltip } from './quake-tooltip';
import type { GlobeControls } from './use-globe-controls';
import { getQuakeKey, useHoveredQuake } from './use-hovered-quake';

export type MapCentre = { lat: number; lon: number };
export type MapHandover = {
  activate: (urlZoom?: number) => boolean;
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

function getQuakeFeatures(earthquakes: readonly Earthquake[]) {
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
        radius: getQuakeMapRadiusPx(earthquake.magnitude),
      },
    })),
  };
}

function getFeltFeatures(earthquake: Earthquake | undefined) {
  const reachKm = earthquake ? getFeltReachKm(earthquake) : 0;
  if (!earthquake || !(reachKm > 0)) return { type: 'FeatureCollection' as const, features: [] };
  const { polygon, outline } = getFeltRing(earthquake.latitude, earthquake.longitude, reachKm);
  const properties = { color: getDepthColor(earthquake.depthKm) };
  return {
    type: 'FeatureCollection' as const,
    features: [
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
    ],
  };
}

function getSelectedEarthquake(
  earthquakes: readonly Earthquake[],
  quake: string | undefined,
): Earthquake | undefined {
  if (quake === undefined) return undefined;
  return earthquakes.find((earthquake) => getQuakeKey(earthquake) === quake);
}

function setQuakeData(map: MapLibreMap, earthquakes: readonly Earthquake[]) {
  map.getSource<GeoJSONSource>(QUAKE_SOURCE_ID)?.setData(getQuakeFeatures(earthquakes));
}

function setFeltData(map: MapLibreMap, earthquake: Earthquake | undefined) {
  map.getSource<GeoJSONSource>(FELT_SOURCE_ID)?.setData(getFeltFeatures(earthquake));
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
  const selectedEarthquakeRef = useRef(selectedEarthquake);
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

  function handleHover(event: MapLayerMouseEvent | null) {
    const map = mapRef.current;
    const key = event?.features?.[0]?.properties.key;
    const earthquake = earthquakes.find((candidate) => getQuakeKey(candidate) === key);
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
    selectedEarthquakeRef.current = selectedEarthquake;
  });

  useEffect(() => {
    if (mapRef.current) setQuakeData(mapRef.current, earthquakes);
  }, [earthquakes]);

  useEffect(() => {
    if (mapRef.current) setFeltData(mapRef.current, selectedEarthquake);
  }, [selectedEarthquake]);

  useEffect(() => {
    if (!hovered) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') hide();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
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
      setQuakeData(map, earthquakesRef.current);
      setFeltData(map, selectedEarthquakeRef.current);
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

    function handleQuakeMove(event: MapLayerMouseEvent) {
      map.getCanvas().style.cursor = 'pointer';
      callbacksRef.current.onHover(event);
    }

    function handleQuakeLeave() {
      map.getCanvas().style.cursor = '';
      callbacksRef.current.onHover(null);
    }

    function handleQuakeClick(event: MapLayerMouseEvent) {
      const key = event.features?.[0]?.properties.key;
      const earthquake = earthquakesRef.current.find((candidate) => getQuakeKey(candidate) === key);
      if (earthquake) callbacksRef.current.onSelect(earthquake);
    }

    sync(controls.viewRef.current);
    controls.setFrameListener(sync);
    handoverRef.current = { activate, focus };
    map.once('style.load', handleStyleLoad);
    map.on('movestart', handleMoveStart);
    map.on('moveend', handleMoveEnd);
    map.on('mousemove', QUAKE_LAYER_ID, handleQuakeMove);
    map.on('mouseleave', QUAKE_LAYER_ID, handleQuakeLeave);
    map.on('click', QUAKE_LAYER_ID, handleQuakeClick);
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
