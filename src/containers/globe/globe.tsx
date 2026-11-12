import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

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
  getViewCamera,
} from '@/lib/globe/motion';
import { getPickedQuakeIndex, getQuakeScreenPoints } from '@/lib/globe/picking';
import { m } from '@/paraglide/messages';

import { GlobeScene } from './globe-scene';
import { GlobeErrorBoundary, GlobeUnavailable } from './globe-unavailable';
import { type GlobeWaves, createGlobeWaves } from './globe-waves';
import { QuakeTooltip } from './quake-tooltip';
import { SceneCanvas } from './scene-canvas';
import { type HoverOptions, useGlobeControls } from './use-globe-controls';

type Point = { x: number; y: number };
type HoveredQuake = {
  earthquake: Earthquake;
  now: number;
  anchor: Point;
  containerSize: { width: number; height: number };
};

declare global {
  interface Window {
    __playGlobeWaves?: GlobeWaves['play'];
    __globeQuakePoints?: () => { id: string; x: number; y: number }[];
    __globeView?: () => Camera;
  }
}

const EMPTY_EARTHQUAKES: readonly Earthquake[] = [];
const HOVER_HIDE_DELAY_MS = 150;
const homeRoute = getRouteApi('/');

function isWebGLAvailable(): boolean {
  const context = document.createElement('canvas').getContext('webgl2');
  context?.getExtension('WEBGL_lose_context')?.loseContext();
  return context !== null;
}

function getQuakeKey({ source, id }: Earthquake): string {
  return `${source}:${id}`;
}

function getSelectedEarthquake(
  earthquakes: readonly Earthquake[],
  quake: string | undefined,
): Earthquake | undefined {
  if (quake === undefined) return undefined;
  return earthquakes.find((earthquake) => getQuakeKey(earthquake) === quake);
}

function getInitialView({ lat, lon, zoom }: EarthquakeSearch): GlobeView | undefined {
  if (lat === undefined || lon === undefined || zoom === undefined) return undefined;
  return getSearchView(lat, lon, zoom);
}

function getCursorClassName(isOverQuake: boolean): string {
  return isOverQuake ? 'cursor-pointer' : 'cursor-grab';
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

function useHoveredQuake() {
  const [hovered, setHovered] = useState<HoveredQuake | null>(null);
  const [isOverQuake, setIsOverQuake] = useState(false);
  const keyRef = useRef<string | null>(null);
  const isOverQuakeRef = useRef(false);
  const isOverTooltipRef = useRef(false);
  const hideTimerRef = useRef<number | undefined>(undefined);

  const actions = useMemo(() => {
    function updateOverQuake(next: boolean) {
      if (isOverQuakeRef.current === next) return;
      isOverQuakeRef.current = next;
      setIsOverQuake(next);
    }

    function cancelHide() {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = undefined;
    }

    function hide() {
      cancelHide();
      updateOverQuake(false);
      isOverTooltipRef.current = false;
      if (keyRef.current === null) return;
      keyRef.current = null;
      setHovered(null);
    }

    function show(next: HoveredQuake) {
      cancelHide();
      updateOverQuake(true);
      const key = getQuakeKey(next.earthquake);
      if (keyRef.current === key) return;
      keyRef.current = key;
      setHovered(next);
    }

    function scheduleHide() {
      updateOverQuake(false);
      if (keyRef.current === null || isOverTooltipRef.current) return;
      if (hideTimerRef.current !== undefined) return;
      hideTimerRef.current = window.setTimeout(hide, HOVER_HIDE_DELAY_MS);
    }

    function enterTooltip() {
      isOverTooltipRef.current = true;
      cancelHide();
    }

    function leaveTooltip() {
      isOverTooltipRef.current = false;
      scheduleHide();
    }

    return { show, scheduleHide, hide, enterTooltip, leaveTooltip };
  }, []);

  useEffect(() => () => window.clearTimeout(hideTimerRef.current), []);

  return { hovered, isOverQuake, ...actions };
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
  });
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
    controls.flyTo(
      getCenteredView(earthquake.latitude, earthquake.longitude, controls.viewRef.current),
    );
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
    setCamera(getViewCamera(view));
  }

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
    if (quake === undefined) {
      lastFlownRef.current = undefined;
      return;
    }
    if (!selectedEarthquake || quake === lastFlownRef.current) return;
    lastFlownRef.current = quake;
    hideHover();
    const { latitude, longitude } = selectedEarthquake;
    controls.flyTo(getCenteredView(latitude, longitude, controls.viewRef.current));
  }, [quake, selectedEarthquake, controls, hideHover]);

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
        aria-describedby={hovered ? tooltipId : undefined}
        className={`absolute inset-0 touch-none select-none ${getCursorClassName(isOverQuake)}`}
      >
        <SceneCanvas>
          <GlobeScene controls={controls} earthquakes={earthquakes} waves={waves} />
        </SceneCanvas>
      </div>
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
