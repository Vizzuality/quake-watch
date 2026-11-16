import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { Suspense, lazy, useEffect, useId, useMemo, useRef, useState } from 'react';

import { type Camera, getWrappedLongitude, useCameraSearch } from '@/hooks/use-camera-search';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { type EarthquakeSearch, getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getGlobeFrame } from '@/lib/globe/frame';
import { getFramedLongitude } from '@/lib/globe/framing';
import {
  type GlobeView,
  getCenteredView,
  getFramedView,
  getSearchView,
  MAP_MOUNT_ZOOM,
  MAP_UNMOUNT_ZOOM,
  ZOOM_RANGE,
  getViewCamera,
} from '@/lib/globe/motion';
import { getPickedQuakeIndex, getQuakeScreenPoints } from '@/lib/globe/picking';
import { getLatLonVector, getRotatedVector } from '@/lib/globe/sphere';
import { m } from '@/paraglide/messages';

import { GlobeScene } from './globe-scene';
import { GlobeErrorBoundary, GlobeUnavailable } from './globe-unavailable';
import { type GlobeWaves, createGlobeWaves } from './globe-waves';
import type { MapCentre, MapHandover } from './maplibre-map';
import { QuakeTooltip } from './quake-tooltip';
import { SceneCanvas } from './scene-canvas';
import { type HoverOptions, useGlobeControls } from './use-globe-controls';
import { type HoveredQuake, type Point, getQuakeKey, useHoveredQuake } from './use-hovered-quake';

declare global {
  interface Window {
    __playGlobeWaves?: GlobeWaves['play'];
    __globeQuakePoints?: () => { id: string; x: number; y: number }[];
    __globeView?: () => Camera;
    __globeProject?: (lat: number, lon: number) => Point | null;
  }
}

const EMPTY_EARTHQUAKES: readonly Earthquake[] = [];
const homeRoute = getRouteApi('/');
const GlobeMap = lazy(() => import('./maplibre-map'));
const CENTRE_TOLERANCE = 1e-4;

function isWebGLAvailable(): boolean {
  const context = document.createElement('canvas').getContext('webgl2');
  context?.getExtension('WEBGL_lose_context')?.loseContext();
  return context !== null;
}

function getSelectedEarthquake(
  earthquakes: readonly Earthquake[],
  quake: string | undefined,
): Earthquake | undefined {
  if (quake === undefined) return undefined;
  return earthquakes.find((earthquake) => getQuakeKey(earthquake) === quake);
}

function getInitialMapZoom({ lat, lon, zoom }: EarthquakeSearch): number | undefined {
  if (lat === undefined || lon === undefined || zoom === undefined) return undefined;
  if (zoom <= ZOOM_RANGE[1]) return undefined;
  return zoom;
}

function getInitialView({ lat, lon, zoom }: EarthquakeSearch): GlobeView | undefined {
  if (lat === undefined || lon === undefined || zoom === undefined) return undefined;
  return getSearchView(lat, lon, zoom);
}

function isViewCentredOn(view: GlobeView, { latitude, longitude }: Earthquake): boolean {
  const target = getCenteredView(latitude, longitude, view);
  return (
    Math.abs(view.lat - target.lat) < CENTRE_TOLERANCE &&
    Math.abs(view.lon - target.lon) < CENTRE_TOLERANCE
  );
}

function getCursorClassName(isOverQuake: boolean): string {
  return isOverQuake ? 'cursor-pointer' : 'cursor-grab';
}

function getProjectedPoint(container: HTMLElement, view: GlobeView, lat: number, lon: number) {
  const frame = getGlobeFrame(container.clientWidth, container.clientHeight);
  const [x, y, z] = getRotatedVector(getLatLonVector(lat, lon), view.lon, view.lat);
  if (z < 0) return null;
  const rect = container.getBoundingClientRect();
  const scale = frame.radius * view.zoom;
  return { x: rect.left + frame.cx + x * scale, y: rect.top + frame.cy - y * scale };
}

function getHoveredQuake(
  earthquakes: readonly Earthquake[],
  view: GlobeView,
  container: HTMLElement,
  point: Point,
): HoveredQuake | null {
  const containerSize = { width: container.clientWidth, height: container.clientHeight };
  const frame = getGlobeFrame(containerSize.width, containerSize.height);
  const points = getQuakeScreenPoints(earthquakes, view, frame);
  const index = getPickedQuakeIndex(points, point.x, point.y);
  const epicentre = points.find((candidate) => candidate.index === index);
  if (!epicentre) return null;
  return {
    earthquake: earthquakes[epicentre.index],
    now: Date.now(),
    anchor: { x: epicentre.x, y: epicentre.y },
    containerSize,
  };
}

function GlobeCanvas() {
  const search = homeRoute.useSearch();
  const navigate = homeRoute.useNavigate();
  const { data } = useQuery(earthquakesQueryOptions(getEarthquakeFilters(search)));
  const setCamera = useCameraSearch();
  const containerRef = useRef<HTMLDivElement>(null);
  const [initialView] = useState(() => getInitialView(search));
  const controls = useGlobeControls(containerRef, {
    initialView,
    onHover: handleHover,
    onTap: handleTap,
    onSettle: handleSettle,
    onZoomPastMax: () => activateMap(),
    onZoom: handleZoom,
  });
  const [isMapMounted, setIsMapMounted] = useState(
    () => (initialView?.zoom ?? 0) >= MAP_MOUNT_ZOOM,
  );
  const [isMapActive, setIsMapActive] = useState(false);
  const initialMapZoomRef = useRef(getInitialMapZoom(search));
  const mapLayerRef = useRef<HTMLDivElement>(null);
  const mapHandoverRef = useRef<MapHandover | null>(null);
  const pendingMapQuakeRef = useRef<Earthquake | null>(null);
  const {
    hovered,
    isOverQuake,
    show: showHover,
    scheduleHide: scheduleHoverHide,
    hide: hideHover,
    enterTooltip,
    leaveTooltip,
  } = useHoveredQuake();
  const tooltipId = useId();
  const earthquakes = data?.earthquakes ?? EMPTY_EARTHQUAKES;
  const { quake } = search;
  const selectedEarthquake = useMemo(
    () => getSelectedEarthquake(earthquakes, quake),
    [earthquakes, quake],
  );
  const variant = selectedEarthquake === undefined ? 'full' : 'compact';
  const [waves] = useState(createGlobeWaves);
  const lastFlownRef = useRef<string | undefined>(undefined);
  const isFramingDecidedRef = useRef(false);

  function getPointedQuake(point: Point): HoveredQuake | null {
    const container = containerRef.current;
    if (!container) return null;
    return getHoveredQuake(earthquakes, controls.viewRef.current, container, point);
  }

  function selectQuake(earthquake: Earthquake) {
    const key = getQuakeKey(earthquake);
    hideHover();
    pendingMapQuakeRef.current = earthquake;
    setIsMapMounted(true);
    controls.flyTo({
      ...getCenteredView(earthquake.latitude, earthquake.longitude, controls.viewRef.current),
      zoom: ZOOM_RANGE[1],
    });
    lastFlownRef.current = key;
    if (key === quake) return;
    void navigate({ search: (prev) => ({ ...prev, quake: key }) });
  }

  function handleHover(point: Point | null, options?: HoverOptions) {
    const pointed = point && getPointedQuake(point);
    if (pointed) showHover(pointed);
    else if (options?.immediate) hideHover();
    else scheduleHoverHide();
  }

  function handleTap(point: Point) {
    const pointed = getPointedQuake(point);
    if (pointed) selectQuake(pointed.earthquake);
  }

  function handleSettle(view: GlobeView) {
    if (isMapActive) return;
    setCamera(getViewCamera(view));
    focusPendingQuake(view);
  }

  function handleZoom(view: GlobeView) {
    if (isMapActive) return;
    initialMapZoomRef.current = undefined;
    pendingMapQuakeRef.current = null;
    if (view.zoom >= MAP_MOUNT_ZOOM) setIsMapMounted(true);
    if (view.zoom < MAP_UNMOUNT_ZOOM) setIsMapMounted(false);
  }

  function activateMap(urlZoom?: number): boolean {
    if (isMapActive || !mapHandoverRef.current?.activate(urlZoom)) return false;
    hideHover();
    setIsMapActive(true);
    return true;
  }

  function dropPendingQuake(view: GlobeView) {
    pendingMapQuakeRef.current = null;
    if (view.zoom < MAP_UNMOUNT_ZOOM) setIsMapMounted(false);
  }

  function focusPendingQuake(view: GlobeView) {
    const earthquake = pendingMapQuakeRef.current;
    if (!earthquake) return;
    if (!isViewCentredOn(view, earthquake)) {
      dropPendingQuake(view);
      return;
    }
    if (view.zoom < ZOOM_RANGE[1] || !activateMap()) return;
    pendingMapQuakeRef.current = null;
    mapHandoverRef.current?.focus(earthquake);
  }

  function handleMapReady() {
    const urlZoom = initialMapZoomRef.current;
    initialMapZoomRef.current = undefined;
    if (urlZoom !== undefined) activateMap(urlZoom);
    else if (!controls.isAnimating()) focusPendingQuake(controls.viewRef.current);
  }

  function handleMapExit(centre: MapCentre) {
    const view = getSearchView(centre.lat, centre.lon, ZOOM_RANGE[1]);
    controls.jumpTo(view);
    setCamera(getViewCamera(view));
    setIsMapActive(false);
  }

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__globeProject = (lat, lon) => {
      const container = containerRef.current;
      if (!container) return null;
      return getProjectedPoint(container, controls.viewRef.current, lat, lon);
    };
    return () => {
      delete window.__globeProject;
    };
  }, [controls]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__playGlobeWaves = waves.play;
    return () => {
      delete window.__playGlobeWaves;
    };
  }, [waves]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__globeQuakePoints = () => {
      const container = containerRef.current;
      if (!container) return [];
      const rect = container.getBoundingClientRect();
      const frame = getGlobeFrame(container.clientWidth, container.clientHeight);
      return getQuakeScreenPoints(earthquakes, controls.viewRef.current, frame).map(
        ({ index, x, y }) => ({
          id: getQuakeKey(earthquakes[index]),
          x: x + rect.left,
          y: y + rect.top,
        }),
      );
    };
    return () => {
      delete window.__globeQuakePoints;
    };
  }, [earthquakes, controls]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__globeView = () => {
      const { lat, lon, zoom } = getViewCamera(controls.viewRef.current);
      return { lat, lon: getWrappedLongitude(lon), zoom };
    };
    return () => {
      delete window.__globeView;
    };
  }, [controls]);

  useEffect(() => {
    if (data === undefined || isFramingDecidedRef.current) return;
    isFramingDecidedRef.current = true;
    if (initialView !== undefined || quake !== undefined) return;
    const longitude = getFramedLongitude(data.earthquakes);
    if (longitude === undefined) return;
    controls.frameTo(getFramedView(longitude, controls.viewRef.current));
  }, [data, initialView, quake, controls]);

  useEffect(() => {
    const pending = pendingMapQuakeRef.current;
    if (pending && getQuakeKey(pending) !== quake) pendingMapQuakeRef.current = null;
    if (quake === undefined) {
      lastFlownRef.current = undefined;
      return;
    }
    if (!selectedEarthquake || quake === lastFlownRef.current) return;
    lastFlownRef.current = quake;
    if (isMapActive) return;
    hideHover();
    const { latitude, longitude } = selectedEarthquake;
    controls.flyTo(getCenteredView(latitude, longitude, controls.viewRef.current));
  }, [quake, selectedEarthquake, controls, hideHover, isMapActive]);

  useEffect(() => {
    controls.setHeld(hovered !== null || selectedEarthquake !== undefined);
  }, [controls, hovered, selectedEarthquake]);

  useEffect(() => {
    if (!hovered) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') hideHover();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hovered, hideHover]);

  return (
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- an <img> element cannot host the WebGL canvas
        role="img"
        aria-label={m.globe_label()}
        aria-hidden={isMapActive}
        aria-describedby={hovered ? tooltipId : undefined}
        className={`absolute inset-0 touch-none select-none ${getCursorClassName(isOverQuake)}`}
      >
        <SceneCanvas>
          <GlobeScene controls={controls} earthquakes={earthquakes} waves={waves} />
        </SceneCanvas>
      </div>
      {isMapMounted && (
        <div
          ref={mapLayerRef}
          inert={!isMapActive}
          className="pointer-events-none absolute inset-0 opacity-0"
        >
          <GlobeErrorBoundary fallback={null}>
            <Suspense fallback={null}>
              <GlobeMap
                controls={controls}
                globeRef={containerRef}
                layerRef={mapLayerRef}
                handoverRef={mapHandoverRef}
                onReady={handleMapReady}
                onExit={handleMapExit}
              />
            </Suspense>
          </GlobeErrorBoundary>
        </div>
      )}
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
    </div>
  );
}

export default function Globe() {
  const [isSupported] = useState(isWebGLAvailable);

  if (!isSupported) return <GlobeUnavailable />;
  return (
    <GlobeErrorBoundary>
      <GlobeCanvas />
    </GlobeErrorBoundary>
  );
}
