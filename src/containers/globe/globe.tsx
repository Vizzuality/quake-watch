import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import {
  Suspense,
  lazy,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { useArrivals } from '@/hooks/use-arrivals';
import { type Camera, getWrappedLongitude, useCameraSearch } from '@/hooks/use-camera-search';
import { getNewestArrival, isNoteworthyArrival } from '@/lib/earthquakes/arrivals';
import { getLiveSnapshot, playbackClock } from '@/lib/earthquakes/playback-clock';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { getSearchArea } from '@/lib/earthquakes/search-area';
import { type EarthquakeSearch, getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import { getShownEarthquakes } from '@/lib/earthquakes/timeline';
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
import { getIsHomeSheetOpen, subscribeHomeSheet } from '@/lib/layout/home-sheet-store';
import {
  getIsSectionShown,
  getIsSectionShownOnServer,
  subscribeSectionShown,
} from '@/lib/section/section-shown-store';
import { m } from '@/paraglide/messages';

import { subscribeGlobeFlyTo } from './globe-fly-to';
import { GlobeScene } from './globe-scene';
import { subscribeGlobeSelect } from './globe-select';
import { GlobeErrorBoundary, GlobeUnavailable } from './globe-unavailable';
import { type GlobeWaves, createGlobeWaves } from './globe-waves';
import type { MapCentre, MapHandover } from './maplibre-map';
import { QuakeTooltip } from './quake-tooltip';
import { SceneCanvas } from './scene-canvas';
import { type HoverOptions, useGlobeControls } from './use-globe-controls';
import {
  type HoveredQuake,
  type Point,
  getQuakeKey,
  getSelectedEarthquake,
  listenForTooltipEscape,
  useHoveredQuake,
} from './use-hovered-quake';
import { subscribeWaveReplay } from './wave-replay';

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
// A rejected chunk must not reach SceneErrorBoundary, which would take the whole globe down.
const GlobeLabels = lazy(() => import('./globe-labels').catch(() => ({ default: () => null })));
const ZoomButtons = lazy(() => import('./zoom-buttons').catch(() => ({ default: () => null })));
const CENTRE_TOLERANCE = 1e-4;
const ZOOM_STEP_FACTOR = 1.5;
const PLACE_ZOOM = 3;

function isWebGLAvailable(): boolean {
  const context = document.createElement('canvas').getContext('webgl2');
  context?.getExtension('WEBGL_lose_context')?.loseContext();
  return context !== null;
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

function getAreaKey({ plat, plon, radius }: EarthquakeSearch): string | undefined {
  if (plat === undefined || plon === undefined) return undefined;
  return `${plat},${plon},${radius}`;
}

function isPinningTap(
  pointerType: string,
  selected: Earthquake | undefined,
  isPlaying: boolean,
): boolean {
  return (pointerType === 'touch' || pointerType === 'pen') && selected === undefined && !isPlaying;
}

function isSameQuake(pinned: HoveredQuake | null, pointed: HoveredQuake): boolean {
  return pinned !== null && getQuakeKey(pinned.earthquake) === getQuakeKey(pointed.earthquake);
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
    onDragStart: () => unpin(),
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
    pinned,
    isOverQuake,
    show: showHover,
    scheduleHide: scheduleHoverHide,
    hide: hideHover,
    enterTooltip,
    leaveTooltip,
    pin,
    unpin,
  } = useHoveredQuake();
  const tooltipId = useId();
  const earthquakes = data?.earthquakes ?? EMPTY_EARTHQUAKES;
  const { quake, plat, plon, radius } = search;
  const area = useMemo(() => getSearchArea({ plat, plon, radius }), [plat, plon, radius]);
  const areaKey = getAreaKey(search);
  const selectedEarthquake = useMemo(
    () => getSelectedEarthquake(earthquakes, quake),
    [earthquakes, quake],
  );
  const variant = selectedEarthquake === undefined ? 'full' : 'compact';
  const card = pinned ?? hovered;
  const playback = useSyncExternalStore(
    playbackClock.subscribe,
    playbackClock.getSnapshot,
    getLiveSnapshot,
  );
  const isPaused = playback.playhead !== null && !playback.isPlaying;
  const isSectionShown = useSyncExternalStore(
    subscribeSectionShown,
    getIsSectionShown,
    getIsSectionShownOnServer,
  );
  const isGlobeHidden = isMapActive || isSectionShown;
  const [waves] = useState(() => createGlobeWaves(controls.isReducedMotion));
  const lastFlownRef = useRef<string | undefined>(undefined);
  const lastAreaKeyRef = useRef(initialView === undefined ? undefined : areaKey);
  const isFramingDecidedRef = useRef(false);

  function getPointedQuake(point: Point): HoveredQuake | null {
    const container = containerRef.current;
    if (!container) return null;
    const shown = getShownEarthquakes(earthquakes, playbackClock.getPlayhead());
    return getHoveredQuake(shown, controls.viewRef.current, container, point);
  }

  function selectQuake(earthquake: Earthquake) {
    const key = getQuakeKey(earthquake);
    hideHover();
    unpin();
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

  function handlePinningTap(pointed: HoveredQuake | null) {
    if (!pointed) unpin();
    else if (isSameQuake(pinned, pointed)) selectQuake(pointed.earthquake);
    else pin(pointed);
  }

  function handleTap(point: Point, pointerType: string) {
    const pointed = getPointedQuake(point);
    if (isPinningTap(pointerType, selectedEarthquake, playback.isPlaying)) {
      handlePinningTap(pointed);
    } else if (pointed) selectQuake(pointed.earthquake);
  }

  function handleSettle(view: GlobeView) {
    unpin();
    if (isMapActive) return;
    setCamera(getViewCamera(view));
    focusPendingQuake(view);
  }

  function handleZoom(view: GlobeView) {
    unpin();
    if (isMapActive) return;
    initialMapZoomRef.current = undefined;
    pendingMapQuakeRef.current = null;
    if (view.zoom >= MAP_MOUNT_ZOOM) setIsMapMounted(true);
    if (view.zoom < MAP_UNMOUNT_ZOOM) setIsMapMounted(false);
  }

  function activateMap(urlZoom?: number): boolean {
    if (isMapActive || !mapHandoverRef.current?.activate(urlZoom)) return false;
    hideHover();
    unpin();
    setIsMapActive(true);
    if (document.activeElement === containerRef.current) {
      mapLayerRef.current?.querySelector<HTMLElement>('.maplibregl-canvas')?.focus();
    }
    return true;
  }

  function handleZoomButton(direction: 1 | -1) {
    if (isMapActive) mapHandoverRef.current?.zoom(direction);
    else controls.zoomBy(ZOOM_STEP_FACTOR ** direction);
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

  function handleMapExit(centre: MapCentre, hadFocus: boolean) {
    const view = getSearchView(centre.lat, centre.lon, ZOOM_RANGE[1]);
    controls.jumpTo(view);
    setCamera(getViewCamera(view));
    setIsMapActive(false);
    if (hadFocus) containerRef.current?.focus();
  }

  useArrivals((arrived) => {
    const newest = getNewestArrival(arrived);
    if (newest) waves.pulse(newest.id);
    if (arrived.some(isNoteworthyArrival)) unpin();
  });

  const handleSelectRequest = useEffectEvent((earthquake: Earthquake) => {
    if (!isMapActive) {
      selectQuake(earthquake);
      return;
    }
    void navigate({ search: (prev) => ({ ...prev, quake: getQuakeKey(earthquake) }) });
  });

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

  useEffect(() => subscribeWaveReplay((id) => waves.play([id])), [waves]);

  useEffect(() => subscribeGlobeSelect(handleSelectRequest), []);

  useEffect(
    () =>
      subscribeGlobeFlyTo((earthquake) => {
        unpin();
        waves.pulse(earthquake.id);
        if (isMapActive) {
          mapHandoverRef.current?.centre(earthquake);
          return;
        }
        const { latitude, longitude } = earthquake;
        controls.flyTo(getCenteredView(latitude, longitude, controls.viewRef.current));
      }),
    [controls, waves, unpin, isMapActive],
  );

  useEffect(() => {
    if (playback.isPlaying) unpin();
  }, [playback.isPlaying, unpin]);

  useEffect(
    () =>
      subscribeHomeSheet(() => {
        if (getIsHomeSheetOpen()) unpin();
      }),
    [unpin],
  );

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
    if (areaKey !== undefined) return;
    const longitude = getFramedLongitude(data.earthquakes);
    if (longitude === undefined) return;
    controls.frameTo(getFramedView(longitude, controls.viewRef.current));
  }, [data, initialView, quake, areaKey, controls]);

  useEffect(() => {
    if (areaKey === lastAreaKeyRef.current || quake !== undefined) return;
    if (isMapActive) {
      mapHandoverRef.current?.exit();
      return;
    }
    const view = controls.viewRef.current;
    lastAreaKeyRef.current = areaKey;
    if (area === null) {
      controls.flyTo(getFramedView(getViewCamera(view).lon, view));
      return;
    }
    controls.flyTo({ ...getCenteredView(area.latitude, area.longitude, view), zoom: PLACE_ZOOM });
  }, [areaKey, area, quake, controls, isMapActive]);

  useEffect(() => {
    const pending = pendingMapQuakeRef.current;
    if (pending && getQuakeKey(pending) !== quake) pendingMapQuakeRef.current = null;
    if (quake === undefined) {
      lastFlownRef.current = undefined;
      return;
    }
    if (!selectedEarthquake || quake === lastFlownRef.current) return;
    lastFlownRef.current = quake;
    hideHover();
    unpin();
    if (isMapActive) {
      mapHandoverRef.current?.centre(selectedEarthquake);
      return;
    }
    const { latitude, longitude } = selectedEarthquake;
    controls.flyTo(getCenteredView(latitude, longitude, controls.viewRef.current));
  }, [quake, selectedEarthquake, controls, hideHover, unpin, isMapActive]);

  useEffect(() => {
    controls.setHeld(
      card !== null || selectedEarthquake !== undefined || areaKey !== undefined || isPaused,
    );
  }, [controls, card, selectedEarthquake, areaKey, isPaused]);

  useEffect(() => {
    if (!card) return;
    return listenForTooltipEscape(() => {
      hideHover();
      unpin();
    });
  }, [card, hideHover, unpin]);

  return (
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        role="application"
        tabIndex={isGlobeHidden ? -1 : 0}
        aria-label={m.globe_label()}
        aria-hidden={isGlobeHidden}
        aria-describedby={card ? tooltipId : undefined}
        className={`absolute inset-0 touch-none select-none focus-visible:-outline-offset-2 ${getCursorClassName(isOverQuake)}`}
      >
        <SceneCanvas>
          <GlobeScene
            controls={controls}
            earthquakes={earthquakes}
            selectedEarthquake={selectedEarthquake}
            hoveredEarthquake={card?.earthquake}
            area={area}
            waves={waves}
            isHidden={isMapActive || isSectionShown}
          />
          <Suspense fallback={null}>
            <GlobeLabels controls={controls} />
          </Suspense>
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
      {!isSectionShown && (
        <Suspense fallback={null}>
          <ZoomButtons
            isDetail={quake !== undefined}
            keyTargetRef={containerRef}
            onZoom={handleZoomButton}
            onRotate={controls.rotateBy}
          />
        </Suspense>
      )}
      {card && (
        <QuakeTooltip
          id={tooltipId}
          earthquake={card.earthquake}
          now={card.now}
          variant={variant}
          isPinned={card === pinned}
          anchor={card.anchor}
          containerSize={card.containerSize}
          onOpen={() => selectQuake(card.earthquake)}
          getWheelTarget={() => containerRef.current}
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
