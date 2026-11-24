import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import type { GeoJSONSource, LngLatLike, Map as MapLibreMap } from 'maplibre-gl';
import { type RefObject, useEffect, useMemo, useRef } from 'react';

import { getQuakeKey, getSelectedEarthquake } from '@/containers/globe/use-hovered-quake';
import { useIsWavePaused } from '@/containers/globe/wave-pause';
import { subscribeWaveReplay } from '@/containers/globe/wave-replay';
import { usePhoneLayout } from '@/hooks/use-phone-layout';
import { AREA_MIN_RADIUS_KM, getAreaRadiusKm } from '@/lib/earthquakes/area-strip';
import { getFeltReachKm } from '@/lib/earthquakes/intensity';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getKmLabel } from '@/lib/format';
import { getDestination, getFeltRing } from '@/lib/globe/map-felt-rings';
import { getMiniGlobeRect } from '@/lib/globe/map-locator';
import {
  LOOP_RING_LOOK,
  REPLAY_RING_LOOK,
  RING_LABEL_LOOK,
  type ReplayRing,
  getLoopRings,
  getMapFadeMask,
  getReplayRings,
} from '@/lib/globe/map-overlay';
import { getScaleBar, getScaleBarLabels, getScaleBarMaxPx } from '@/lib/globe/map-scale-bar';
import {
  AREA_SOURCE_ID,
  FELT_FILL_LAYER_ID,
  FELT_LINE_LAYER_ID,
  MAP_COLORS,
  SELECTED_LAYER_ID,
  SELECTED_RING_LAYER_ID,
  getFeltRingPaint,
  getSelectedQuakeFilter,
} from '@/lib/globe/map-style';
import { EARTH_RADIUS_KM } from '@/lib/globe/quakes';
import { getFeltRingLabel, getFeltRingShortLabel } from '@/lib/i18n/map-labels';
import { isPhoneViewport } from '@/lib/layout/phone';
import { getPhoneDetailOverlayStyle, getPhoneFeltLabelPlacement } from '@/lib/layout/phone-detail';
import { getIsSectionShown, subscribeSectionShown } from '@/lib/section/section-shown-store';
import { getLocale } from '@/paraglide/runtime';

import { AreaStrip } from './area-strip';
import { MiniGlobe } from './mini-globe';

const homeRoute = getRouteApi('/');
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const SCALE_SAMPLE_KM = 100;
const EAST_RADIANS = Math.PI / 2;
const RADIANS_PER_DEGREE = Math.PI / 180;
const LOOP_REST_MS = LOOP_RING_LOOK.cycleMs - LOOP_RING_LOOK.activeMs;
const EMPTY_EARTHQUAKES: readonly Earthquake[] = [];
const LABEL_CLASS_NAME =
  'pointer-events-none absolute top-0 left-0 text-label-s whitespace-nowrap uppercase';
const SCALE_LABEL_CLASS_NAME =
  'absolute -top-[19px] text-label leading-none font-medium whitespace-nowrap text-foreground uppercase';

type Point = { x: number; y: number };
type Replay = { id: string; startedAt: number };
type Motion = { replay: Replay | null; loopStartedAt: number | null };
type OverlayCamera = { centre: Point; feltPx: number };
type ScaleRefs = {
  root: RefObject<HTMLDivElement | null>;
  mid: RefObject<HTMLSpanElement | null>;
  end: RefObject<HTMLSpanElement | null>;
};
type OverlayRefs = {
  rings: RefObject<SVGGElement | null>;
  feltLabel: RefObject<HTMLSpanElement | null>;
  areaLabel: RefObject<HTMLSpanElement | null>;
  locatorRect: RefObject<SVGRectElement | null>;
  scale: ScaleRefs;
};
type OverlayInput = {
  earthquake: Earthquake | undefined;
  reachKm: number;
  areaRadiusKm: number;
  locale: string;
};

function getProjected(map: MapLibreMap, lngLat: LngLatLike): Point {
  const { x, y } = map.project(lngLat);
  return { x, y };
}

function getDestinationPoint(
  map: MapLibreMap,
  { latitude, longitude }: Earthquake,
  km: number,
  bearingRadians: number,
): Point {
  return getProjected(
    map,
    getDestination(latitude, longitude, km / EARTH_RADIUS_KM, bearingRadians),
  );
}

function getKmPerPx(map: MapLibreMap): number {
  const { lat, lng } = map.getCenter();
  const centre = getProjected(map, [lng, lat]);
  const east = getProjected(
    map,
    getDestination(lat, lng, SCALE_SAMPLE_KM / EARTH_RADIUS_KM, EAST_RADIANS),
  );
  return SCALE_SAMPLE_KM / Math.hypot(east.x - centre.x, east.y - centre.y);
}

function getAreaRingData(earthquake: Earthquake | undefined, isShown: boolean) {
  if (!earthquake || !isShown) return { type: 'FeatureCollection' as const, features: [] };
  const { outline } = getFeltRing(earthquake.latitude, earthquake.longitude, AREA_MIN_RADIUS_KM);
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: outline },
        properties: {},
      },
    ],
  };
}

function isMapVisible(map: MapLibreMap): boolean {
  for (let element: Element | null = map.getContainer(); element; element = element.parentElement) {
    if (Number(getComputedStyle(element).opacity) < 1) return false;
  }
  return true;
}

function isMapLayerShown(map: MapLibreMap): boolean {
  const opacity = map.getContainer().parentElement?.style.opacity ?? '';
  return opacity === '' || Number(opacity) > 0;
}

function isReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function isReplayRunning(replay: Replay | null, id: string, now: number): replay is Replay {
  return replay?.id === id && now - replay.startedAt < REPLAY_RING_LOOK.durationMs;
}

function getLoopOrigin({ replay, loopStartedAt }: Motion): number | null {
  if (loopStartedAt === null) return null;
  if (!replay) return loopStartedAt;
  const afterReplay =
    replay.startedAt + REPLAY_RING_LOOK.durationMs + LOOP_REST_MS - LOOP_RING_LOOK.delayMs;
  return Math.max(loopStartedAt, afterReplay);
}

function getRings(motion: Motion, id: string, now: number, feltPx: number): ReplayRing[] {
  if (isReplayRunning(motion.replay, id, now)) {
    return getReplayRings(now - motion.replay.startedAt, feltPx);
  }
  const origin = getLoopOrigin(motion);
  if (origin === null) return [];
  return getLoopRings(now - origin, feltPx);
}

function getRingStrokePx(motion: Motion, id: string, now: number): number {
  return isReplayRunning(motion.replay, id, now)
    ? REPLAY_RING_LOOK.strokePx
    : LOOP_RING_LOOK.strokePx;
}

function setLabelPosition(
  label: HTMLElement | null,
  point: Point,
  offsetPx: number,
  transform: string,
) {
  if (!label) return;
  label.style.transform = `translate(${point.x + offsetPx}px, ${point.y}px) ${transform}`;
}

function getLabelSize(element: HTMLElement | null) {
  return { width: element?.offsetWidth ?? 0, height: element?.offsetHeight ?? 0 };
}

function setPhoneFeltLabel(label: HTMLElement | null, centre: Point, radiusPx: number) {
  if (!label) return;
  const { top, isShort } = getPhoneFeltLabelPlacement(
    centre,
    radiusPx,
    getLabelSize(label.querySelector<HTMLElement>('[data-felt-full]')),
    getLabelSize(label.querySelector<HTMLElement>('[data-felt-short]')),
  );
  label.toggleAttribute('data-short', isShort);
  label.style.transform = `translate(${centre.x}px, ${top}px) translateX(-50%)`;
}

function setRings(group: SVGGElement | null, centre: Point, rings: ReplayRing[], strokePx: number) {
  if (!group) return;
  [...group.children].forEach((circle, index) => {
    const ring = rings.at(index);
    circle.setAttribute('visibility', ring ? 'visible' : 'hidden');
    if (!ring) return;
    circle.setAttribute('cx', String(centre.x));
    circle.setAttribute('cy', String(centre.y));
    circle.setAttribute('r', String(ring.radiusPx));
    circle.setAttribute('stroke-opacity', String(ring.alpha));
    circle.setAttribute('stroke-width', String(strokePx));
  });
}

function setText(element: HTMLElement | null, text: string | null) {
  if (!element) return;
  element.hidden = text === null;
  if (text !== null && element.textContent !== text) element.textContent = text;
}

function setScaleBar(map: MapLibreMap, { root, mid, end }: ScaleRefs, locale: string) {
  const bar = getScaleBar(
    getKmPerPx(map),
    getScaleBarMaxPx(map.getContainer().clientWidth, map.getContainer().clientHeight),
  );
  if (!root.current) return;
  root.current.hidden = bar === null;
  if (!bar) return;
  root.current.style.width = `${bar.widthPx}px`;
  const labels = getScaleBarLabels(bar, locale);
  setText(mid.current, labels.mid);
  setText(end.current, labels.end);
}

function setLocatorRect(map: MapLibreMap, rect: SVGRectElement | null) {
  if (!rect) return;
  const bounds = map.getBounds();
  const { halfWidthPx, halfHeightPx } = getMiniGlobeRect(
    {
      west: bounds.getWest(),
      east: bounds.getEast(),
      south: bounds.getSouth(),
      north: bounds.getNorth(),
    },
    map.getCenter().lat,
  );
  rect.setAttribute('x', String(-halfWidthPx));
  rect.setAttribute('y', String(-halfHeightPx));
  rect.setAttribute('width', String(halfWidthPx * 2));
  rect.setAttribute('height', String(halfHeightPx * 2));
}

function setFadeMask(map: MapLibreMap) {
  const canvas = map.getCanvas();
  const container = map.getContainer();
  const { lat, lng } = map.getCenter();
  const mask = getMapFadeMask(
    container.clientWidth,
    container.clientHeight,
    getProjected(map, [lng, lat]),
  );
  if (canvas.style.maskImage === mask) return;
  canvas.style.maskImage = mask;
  canvas.style.webkitMaskImage = mask;
}

function syncCameraOverlay(
  map: MapLibreMap,
  refs: OverlayRefs,
  { earthquake, reachKm, areaRadiusKm, locale }: OverlayInput,
): OverlayCamera | null {
  setFadeMask(map);
  if (!earthquake) return null;
  const centre = getProjected(map, [earthquake.longitude, earthquake.latitude]);
  const east = getDestinationPoint(map, earthquake, reachKm, EAST_RADIANS);
  const feltPx = Math.hypot(east.x - centre.x, east.y - centre.y);
  const { felt, area } = RING_LABEL_LOOK;
  if (isPhoneViewport(map.getContainer().clientWidth, map.getContainer().clientHeight)) {
    setPhoneFeltLabel(refs.feltLabel.current, centre, feltPx);
  } else {
    refs.feltLabel.current?.removeAttribute('data-short');
    setLabelPosition(
      refs.feltLabel.current,
      getDestinationPoint(map, earthquake, reachKm, felt.bearingDeg * RADIANS_PER_DEGREE),
      felt.offsetPx,
      'translateY(-100%)',
    );
  }
  setLabelPosition(
    refs.areaLabel.current,
    getDestinationPoint(map, earthquake, areaRadiusKm, area.bearingDeg * RADIANS_PER_DEGREE),
    area.offsetPx,
    'translate(-100%, -100%)',
  );
  setScaleBar(map, refs.scale, locale);
  setLocatorRect(map, refs.locatorRect.current);
  return { centre, feltPx };
}

function syncRings(
  refs: OverlayRefs,
  camera: OverlayCamera | null,
  { earthquake, reachKm }: OverlayInput,
  motion: Motion,
  now: number,
) {
  if (!earthquake || !camera) return;
  const rings = reachKm > 0 ? getRings(motion, earthquake.id, now, camera.feltPx) : [];
  setRings(refs.rings.current, camera.centre, rings, getRingStrokePx(motion, earthquake.id, now));
}

function isMoving(
  motion: Motion,
  earthquake: Earthquake | undefined,
  reachKm: number,
  now: number,
): boolean {
  if (!earthquake || !(reachKm > 0)) return false;
  return isReplayRunning(motion.replay, earthquake.id, now) || motion.loopStartedAt !== null;
}

type MapScaleBarProps = {
  rootRef: RefObject<HTMLDivElement | null>;
  midRef: RefObject<HTMLSpanElement | null>;
  endRef: RefObject<HTMLSpanElement | null>;
};

export function MapScaleBar({ rootRef, midRef, endRef }: MapScaleBarProps) {
  const layout = usePhoneLayout();

  return (
    <div
      ref={rootRef}
      data-testid="map-scale-bar"
      style={getPhoneDetailOverlayStyle(layout)}
      className="pointer-events-none absolute top-(--scale-bar-top) right-[18px] h-0.5 md:top-auto md:right-14 md:bottom-[238px] short:right-[338px]"
      aria-hidden="true"
    >
      <svg className="absolute inset-0 size-full overflow-visible">
        <rect width="100%" height={2} className="fill-foreground" fillOpacity={0.9} />
        <rect x="50%" width="50%" height={2} className="fill-foreground" fillOpacity={0.35} />
        <rect y={-4} width={1} height={6} className="fill-foreground" fillOpacity={0.9} />
        <rect x="50%" y={-4} width={1} height={6} className="fill-foreground" fillOpacity={0.9} />
        <rect
          x="100%"
          y={-4}
          width={1}
          height={6}
          transform="translate(-1 0)"
          className="fill-foreground"
          fillOpacity={0.9}
        />
      </svg>
      <span
        data-map-measure="scale-start"
        className={`${SCALE_LABEL_CLASS_NAME} left-0 -translate-x-1/2`}
      >
        0
      </span>
      <span
        ref={midRef}
        data-map-measure="scale-mid"
        className={`${SCALE_LABEL_CLASS_NAME} left-1/2 -translate-x-1/2`}
      />
      <span
        ref={endRef}
        data-map-measure="scale-end"
        className={`${SCALE_LABEL_CLASS_NAME} -right-0.5`}
      />
    </div>
  );
}

export function MapOverlay({ map }: { map: MapLibreMap }) {
  const search = homeRoute.useSearch();
  const { data } = useQuery(earthquakesQueryOptions(getEarthquakeFilters(search)));
  const isWavePaused = useIsWavePaused();
  const locale = getLocale();
  const earthquakes = data?.earthquakes ?? EMPTY_EARTHQUAKES;
  const selected = useMemo(
    () => getSelectedEarthquake(earthquakes, search.quake),
    [earthquakes, search.quake],
  );
  const selectedKey = selected ? getQuakeKey(selected) : null;
  const reachKm = selected ? getFeltReachKm(selected) : 0;
  const areaRadiusKm = selected ? getAreaRadiusKm(selected) : AREA_MIN_RADIUS_KM;
  const isAreaRingShown = selected !== undefined && areaRadiusKm === AREA_MIN_RADIUS_KM;
  const selectedId = selected?.id;
  const ringsRef = useRef<SVGGElement>(null);
  const feltLabelRef = useRef<HTMLSpanElement>(null);
  const areaLabelRef = useRef<HTMLSpanElement>(null);
  const locatorRectRef = useRef<SVGRectElement>(null);
  const scaleRootRef = useRef<HTMLDivElement>(null);
  const scaleMidRef = useRef<HTMLSpanElement>(null);
  const scaleEndRef = useRef<HTMLSpanElement>(null);
  const motionRef = useRef<Motion>({ replay: null, loopStartedAt: null });
  const scheduleRef = useRef<() => void>(() => {});

  function startReplay(id: string) {
    if (isReducedMotion()) return;
    motionRef.current.replay = { id, startedAt: performance.now() };
    scheduleRef.current();
  }

  useEffect(() => {
    const filter = getSelectedQuakeFilter(selectedKey);
    const paint = getFeltRingPaint(selectedKey !== null);
    map.setFilter(SELECTED_LAYER_ID, filter);
    map.setFilter(SELECTED_RING_LAYER_ID, filter);
    map.setPaintProperty(FELT_LINE_LAYER_ID, 'line-color', paint.lineColor);
    map.setPaintProperty(FELT_LINE_LAYER_ID, 'line-opacity', paint.lineOpacity);
    map.setPaintProperty(FELT_FILL_LAYER_ID, 'fill-opacity', paint.fillOpacity);
  }, [map, selectedKey]);

  useEffect(() => {
    map
      .getSource<GeoJSONSource>(AREA_SOURCE_ID)
      ?.setData(getAreaRingData(selected, isAreaRingShown));
  }, [map, selected, isAreaRingShown]);

  useEffect(() => subscribeWaveReplay(startReplay), []);

  useEffect(() => {
    motionRef.current.replay = null;
  }, [selectedId]);

  useEffect(() => {
    motionRef.current.loopStartedAt = null;
    scheduleRef.current();
    if (selectedId === undefined || isWavePaused) return;
    function startLoopWhenVisible() {
      if (!isMapVisible(map)) return;
      map.off('idle', startLoopWhenVisible);
      motionRef.current.loopStartedAt = performance.now();
      scheduleRef.current();
    }
    map.on('idle', startLoopWhenVisible);
    startLoopWhenVisible();
    return () => {
      map.off('idle', startLoopWhenVisible);
    };
  }, [map, selectedId, isWavePaused]);

  useEffect(() => {
    const refs: OverlayRefs = {
      rings: ringsRef,
      feltLabel: feltLabelRef,
      areaLabel: areaLabelRef,
      locatorRect: locatorRectRef,
      scale: { root: scaleRootRef, mid: scaleMidRef, end: scaleEndRef },
    };
    const input: OverlayInput = { earthquake: selected, reachKm, areaRadiusKm, locale };
    let request = 0;
    let camera: OverlayCamera | null = null;
    let isCameraStale = true;
    function sync(now: number) {
      request = 0;
      if (!isMapLayerShown(map) || getIsSectionShown()) return;
      if (isCameraStale) {
        camera = syncCameraOverlay(map, refs, input);
        isCameraStale = false;
      }
      syncRings(refs, camera, input, motionRef.current, now);
      if (isMoving(motionRef.current, selected, reachKm, now)) schedule();
    }
    function schedule() {
      if (request) return;
      request = requestAnimationFrame(sync);
    }
    function handleCameraChange() {
      isCameraStale = true;
      schedule();
    }
    scheduleRef.current = schedule;
    schedule();
    map.on('move', handleCameraChange);
    map.on('resize', handleCameraChange);
    map.on('idle', handleCameraChange);
    const unsubscribeSection = subscribeSectionShown(handleCameraChange);
    return () => {
      unsubscribeSection();
      map.off('move', handleCameraChange);
      map.off('resize', handleCameraChange);
      map.off('idle', handleCameraChange);
      cancelAnimationFrame(request);
      scheduleRef.current = () => {};
    };
  }, [map, selected, reachKm, areaRadiusKm, locale]);

  useEffect(() => {
    const canvas = map.getCanvas();
    return () => {
      canvas.style.maskImage = '';
      canvas.style.webkitMaskImage = '';
    };
  }, [map]);

  return (
    <>
      {selected && (
        <>
          <svg
            className="pointer-events-none absolute inset-0 size-full overflow-visible"
            aria-hidden="true"
          >
            <g ref={ringsRef} fill="none" stroke={MAP_COLORS.accent}>
              {Array.from({ length: REPLAY_RING_LOOK.count }, (_, index) => (
                <circle key={index} data-map-measure="replay-ring" visibility="hidden" />
              ))}
            </g>
          </svg>
          {reachKm > 0 && (
            <span
              ref={feltLabelRef}
              data-map-measure="felt-label"
              className={`${LABEL_CLASS_NAME} group/felt grid justify-items-center text-accent`}
            >
              <span
                data-felt-full
                className="col-start-1 row-start-1 group-data-short/felt:invisible"
              >
                {getFeltRingLabel(reachKm, locale)}
              </span>
              <span
                data-felt-short
                className="invisible col-start-1 row-start-1 group-data-short/felt:visible"
              >
                {getFeltRingShortLabel(reachKm, locale)}
              </span>
            </span>
          )}
          {isAreaRingShown && (
            <span
              ref={areaLabelRef}
              data-map-measure="area-label"
              className={`${LABEL_CLASS_NAME} text-muted`}
            >
              {getKmLabel(AREA_MIN_RADIUS_KM, locale)}
            </span>
          )}
          <MiniGlobe
            latitude={selected.latitude}
            longitude={selected.longitude}
            rectRef={locatorRectRef}
          />
          <MapScaleBar rootRef={scaleRootRef} midRef={scaleMidRef} endRef={scaleEndRef} />
        </>
      )}
      <AreaStrip />
    </>
  );
}
