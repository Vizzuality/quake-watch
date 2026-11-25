import 'maplibre-gl/dist/maplibre-gl.css';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import {
  type GeoJSONSource,
  type JumpToOptions,
  Map as MapLibreMap,
  type MapMouseEvent,
  type ProjectionSpecification,
  setWorkerUrl,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { type RefObject, useEffect, useId, useMemo, useRef, useState } from 'react';

import { addMapImages } from '@/containers/detail-map/add-map-images';
import { MAP_FONT_URLS } from '@/containers/detail-map/map-fonts';
import { MapOverlay } from '@/containers/detail-map/map-overlay';
import { getWrappedLongitude, useCameraSearch } from '@/hooks/use-camera-search';
import { usePhoneLayout } from '@/hooks/use-phone-layout';
import { getDepthColor } from '@/lib/earthquakes/depth-color';
import { getFeltReachKm } from '@/lib/earthquakes/intensity';
import { playbackClock } from '@/lib/earthquakes/playback-clock';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { type SearchArea, getSearchArea } from '@/lib/earthquakes/search-area';
import { getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import { getShownCount, getSortedByTime } from '@/lib/earthquakes/timeline';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getAreaMapZoom } from '@/lib/globe/area-view';
import { getMinRingRadiusPx, isFeltRingShown } from '@/lib/globe/felt-rings';
import { getGlobeFrame } from '@/lib/globe/frame';
import { getLabelObstacleBoxes, getObstacleFeatures } from '@/lib/globe/label-obstacles';
import { getFeltRing, getFeltRingBounds } from '@/lib/globe/map-felt-rings';
import {
  MAP_FIELD_OF_VIEW,
  MAP_ZOOM_SPAN,
  getMapFade,
  getMapHandoverPadding,
  getMapProjection,
  getMapZoom,
  getMapZoomFromUrl,
  getUrlZoom,
} from '@/lib/globe/map-handover';
import { setMapNearFarZ } from '@/lib/globe/map-near-far';
import { type MapPadding, getAreaFrame, getDetailPadding } from '@/lib/globe/map-overlay';
import { holdMapRepaints } from '@/lib/globe/map-repaint-hold';
import {
  FELT_SOURCE_ID,
  LABEL_OBSTACLE_SOURCE_ID,
  MAP_ATTRIBUTION,
  MAP_COLORS,
  MAP_STYLE_URL,
  QUAKE_LAYER_ID,
  QUAKE_SOURCE_ID,
  SEARCH_AREA_SOURCE_ID,
  getQuakeMapStyle,
  getReplayFilters,
} from '@/lib/globe/map-style';
import { type GlobeView, ZOOM_RANGE, getViewCamera } from '@/lib/globe/motion';
import { PICK_TOLERANCE_PX, getPickedQuakeIndex } from '@/lib/globe/picking';
import { getEpicentreRadiusPx } from '@/lib/globe/quakes';
import { getSearchAreaFeatures } from '@/lib/globe/search-area-ring';
import { getMapLibreLocale } from '@/lib/i18n/map-labels';
import { getMapSheetTopStyle } from '@/lib/layout/phone-detail';
import { getIsSectionShown, subscribeSectionShown } from '@/lib/section/section-shown-store';
import { getLocale } from '@/paraglide/runtime';

import { watchAttributionCollapse } from './attribution-collapse';
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
  frameArea: (area: SearchArea) => void;
  exit: () => void;
  zoom: (direction: 1 | -1) => void;
};

type GlobeMapProps = {
  controls: GlobeControls;
  globeRef: RefObject<HTMLElement | null>;
  layerRef: RefObject<HTMLDivElement | null>;
  handoverRef: RefObject<MapHandover | null>;
  onReady: () => void;
  onExit: (centre: MapCentre, hadFocus: boolean) => void;
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
        time: earthquake.time,
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
      const properties = { color: getDepthColor(earthquake.depthKm), time: earthquake.time };
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

function isReplaySourceLoaded(map: MapLibreMap): boolean {
  return map.isSourceLoaded(QUAKE_SOURCE_ID) && map.isSourceLoaded(FELT_SOURCE_ID);
}

function setReplayFilters(map: MapLibreMap, playhead: number | null) {
  for (const [layerId, filter] of getReplayFilters(playhead)) map.setFilter(layerId, filter);
}

function getSortedTimes(earthquakes: readonly Earthquake[]): Float64Array {
  return Float64Array.from(getSortedByTime(earthquakes), ({ time }) => time);
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

function getLabelObstacleData(map: MapLibreMap) {
  return getObstacleFeatures(getLabelObstacleBoxes(map.getContainer()), (x, y) =>
    map.unproject([x, y]).toArray(),
  );
}

function getElementDetailPadding(element: HTMLElement): MapPadding {
  return getDetailPadding(element.clientWidth, element.clientHeight);
}

function getFocusPadding(padding: MapPadding): MapPadding {
  return {
    top: padding.top + FOCUS_PADDING_PX,
    bottom: padding.bottom + FOCUS_PADDING_PX,
    left: padding.left + FOCUS_PADDING_PX,
    right: padding.right + FOCUS_PADDING_PX,
  };
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
  const phoneLayout = usePhoneLayout();
  const { hovered, show, scheduleHide, hide, enterTooltip, leaveTooltip } = useHoveredQuake();
  const tooltipId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [readyMap, setReadyMap] = useState<MapLibreMap | null>(null);
  const earthquakes = data?.earthquakes ?? EMPTY_EARTHQUAKES;
  const { plat, plon, radius } = search;
  const area = useMemo(() => getSearchArea({ plat, plon, radius }), [plat, plon, radius]);
  const earthquakesRef = useRef(earthquakes);
  const selectedEarthquake = getSelectedEarthquake(earthquakes, search.quake);
  const selectedRef = useRef(selectedEarthquake);
  const releaseDetailRef = useRef<() => void>(() => {});
  const isSelected = selectedEarthquake !== undefined;
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
    const map = mapRef.current;
    map?.easeTo({
      center: [earthquake.longitude, earthquake.latitude],
      padding: getElementDetailPadding(map.getContainer()),
    });
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
    readyMap?.getSource<GeoJSONSource>(SEARCH_AREA_SOURCE_ID)?.setData(getSearchAreaFeatures(area));
  }, [readyMap, area]);

  useEffect(() => {
    if (!readyMap) return;
    const map = readyMap;
    const sortedTimes = getSortedTimes(earthquakes);
    let shownCount: number | null | undefined;
    function update() {
      const playhead = playbackClock.getPlayhead();
      const next = playhead === null ? null : getShownCount(sortedTimes, playhead);
      if (next === shownCount || !isReplaySourceLoaded(map)) return;
      shownCount = next;
      setReplayFilters(map, playhead);
    }
    update();
    map.on('sourcedata', update);
    const unsubscribe = playbackClock.subscribeFrame(update);
    return () => {
      map.off('sourcedata', update);
      unsubscribe();
    };
  }, [earthquakes, readyMap]);

  useEffect(() => {
    if (!hovered) return;
    return listenForTooltipEscape(hide);
  }, [hovered, hide]);

  useEffect(() => {
    if (!isSelected) releaseDetailRef.current();
  }, [isSelected]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const element: HTMLElement = container;
    const layer = layerRef.current;
    const globe = globeRef.current;
    const map = new MapLibreMap({
      container: element,
      style: MAP_STYLE_URL,
      transformStyle: (_previous, next) => getQuakeMapStyle(next, MAP_FONT_URLS),
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      // Overrides the default 4, which fetches tiles past a source's maxzoom and defeats the z0 underlay: https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/#zoomlevelstooverscale
      zoomLevelsToOverscale: undefined,
      attributionControl: { compact: true, customAttribution: MAP_ATTRIBUTION },
      locale: getMapLibreLocale(getLocale()),
    });
    mapRef.current = map;
    const attribution = watchAttributionCollapse(map);
    // MapLibre paints the background layer only on tiles it can draw, so rows still loading stay transparent.
    map.getCanvas().style.backgroundColor = MAP_COLORS.land;
    map.touchZoomRotate.disableRotation();
    map.setVerticalFieldOfView(MAP_FIELD_OF_VIEW);
    setMapNearFarZ(map);
    let isStyleLoaded = false;
    let isReady = false;
    let isShown = false;
    let isActive = false;
    let hasExited = false;
    let pinchDistance: number | null = null;
    let isSwallowingTouch = false;
    let releaseRepaints: (() => void) | null = null;
    let labelObstacleKey = '';

    function getRadius(globeZoom: number): number {
      return getGlobeFrame(element.clientWidth, element.clientHeight).radius * globeZoom;
    }

    function getMinZoom(): number {
      return getMapZoom(getRadius(ZOOM_RANGE[1]), map.getCenter().lat);
    }

    function syncLabelObstacles() {
      const source = map.getSource<GeoJSONSource>(LABEL_OBSTACLE_SOURCE_ID);
      if (!isShown || !source) return;
      const data = getLabelObstacleData(map);
      const key = JSON.stringify(data);
      if (key === labelObstacleKey) return;
      labelObstacleKey = key;
      source.setData(data);
    }

    function setOpacity(view: GlobeView) {
      const opacity = getMapOpacity(isReady, isActive, view.zoom);
      isShown = opacity > 0;
      if (isShown) attribution.onMapShown();
      if (layer) layer.style.opacity = String(opacity);
      if (globe) globe.style.opacity = String(1 - opacity);
      syncLabelObstacles();
    }

    function getHandoverPadding(): MapPadding {
      const { clientWidth, clientHeight } = element;
      return getMapHandoverPadding(
        clientWidth,
        clientHeight,
        getGlobeFrame(clientWidth, clientHeight),
      );
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
      map.setPadding(getHandoverPadding());
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
      if (selectedRef.current && urlZoom !== undefined) {
        map.setPadding(getElementDetailPadding(element));
      } else if (selectedRef.current) {
        map.easeTo({ padding: getElementDetailPadding(element) });
      }
      setInput(true);
      setOpacity(controls.viewRef.current);
      return true;
    }

    function centre({ latitude, longitude }: Earthquake) {
      const camera: JumpToOptions = {
        center: [longitude, latitude],
        padding: getElementDetailPadding(element),
      };
      if (getIsSectionShown()) map.jumpTo(camera);
      else map.flyTo(camera);
    }

    function getFocusZoom(earthquake: Earthquake, padding: MapPadding): number {
      const { latitude, longitude } = earthquake;
      const reachKm = getFeltReachKm(earthquake);
      if (!(reachKm > 0)) return getMapZoomFromUrl(FOCUS_URL_ZOOM, getMinZoom());
      const { outline, hasPole } = getFeltRing(latitude, longitude, reachKm);
      if (hasPole) return getMinZoom();
      const camera = map.cameraForBounds(getFeltRingBounds(outline), {
        padding: getFocusPadding(padding),
      });
      return camera?.zoom ?? getMinZoom();
    }

    function focus(earthquake: Earthquake) {
      const padding = getElementDetailPadding(element);
      map.easeTo({
        center: [earthquake.longitude, earthquake.latitude],
        zoom: getFocusZoom(earthquake, padding),
        padding,
      });
    }

    function frameArea(area: SearchArea) {
      const { padding, radiusPx } = getAreaFrame(element.clientWidth, element.clientHeight);
      map.easeTo({
        center: [area.longitude, area.latitude],
        zoom: Math.max(getAreaMapZoom(area, radiusPx), getMinZoom()),
        padding,
      });
    }

    function releaseDetail() {
      if (isActive) map.easeTo({ padding: getHandoverPadding() });
    }

    function exit() {
      if (hasExited) return;
      hasExited = true;
      isActive = false;
      map.setMinZoom(null);
      const hadFocus = element.contains(document.activeElement);
      setInput(false);
      const frame = getGlobeFrame(element.clientWidth, element.clientHeight);
      const { lat, lng } = map.unproject([frame.cx, frame.cy]);
      callbacksRef.current.onExit({ lat, lon: lng }, hadFocus);
    }

    function isAtMinZoom(): boolean {
      return isActive && map.getZoom() <= getMinZoom() + EXIT_ZOOM_TOLERANCE;
    }

    function zoom(direction: 1 | -1) {
      if (direction < 0 && isAtMinZoom()) exit();
      else map.zoomTo(map.getZoom() + direction);
    }

    function handleStyleLoad() {
      isStyleLoaded = true;
      addMapImages(map);
      map.setProjection(
        getMapProjection(getMapZoom(getRadius(ZOOM_RANGE[1]), 0)) as ProjectionSpecification,
      );
      setQuakeData(map, earthquakesRef.current, selectedRef.current);
      sync(controls.viewRef.current);
      map.once('idle', () => {
        isReady = true;
        setOpacity(controls.viewRef.current);
        setReadyMap(map);
        callbacksRef.current.onReady();
        handleSectionShown();
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

    function holdRepaints() {
      if (!isReady || !getIsSectionShown() || map.isMoving()) return;
      releaseRepaints ??= holdMapRepaints(map);
    }

    function resumeRepaints() {
      releaseRepaints?.();
      releaseRepaints = null;
    }

    function handleSectionShown() {
      if (getIsSectionShown()) holdRepaints();
      else resumeRepaints();
    }

    sync(controls.viewRef.current);
    const unsubscribeSection = subscribeSectionShown(handleSectionShown);
    controls.setFrameListener(sync);
    handoverRef.current = { activate, centre, focus, frameArea, exit, zoom };
    releaseDetailRef.current = releaseDetail;
    map.once('style.load', handleStyleLoad);
    map.on('move', syncLabelObstacles);
    map.on('resize', () => setMapNearFarZ(map));
    map.on('resize', syncLabelObstacles);
    map.on('idle', syncLabelObstacles);
    map.on('movestart', handleMoveStart);
    map.on('movestart', resumeRepaints);
    map.on('idle', holdRepaints);
    map.on('moveend', handleMoveEnd);
    map.on('mousemove', handlePointerMove);
    map.on('mouseout', handlePointerOut);
    map.on('click', handleClick);
    element.addEventListener('wheel', handleWheel, { capture: true });
    element.addEventListener('touchmove', handleTouchMove, { capture: true });
    element.addEventListener('touchend', handleTouchEnd, { capture: true });
    element.addEventListener('touchcancel', handleTouchEnd, { capture: true });
    element.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('transitionend', syncLabelObstacles);
    if (import.meta.env.DEV) window.__globeMap = map;
    return () => {
      unsubscribeSection();
      controls.setFrameListener(null);
      handoverRef.current = null;
      releaseDetailRef.current = () => {};
      setInput(false);
      if (globe) globe.style.opacity = '';
      element.removeEventListener('wheel', handleWheel, { capture: true });
      element.removeEventListener('touchmove', handleTouchMove, { capture: true });
      element.removeEventListener('touchend', handleTouchEnd, { capture: true });
      element.removeEventListener('touchcancel', handleTouchEnd, { capture: true });
      element.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('transitionend', syncLabelObstacles);
      if (window.__globeMap === map) delete window.__globeMap;
      mapRef.current = null;
      setReadyMap(null);
      attribution.dispose();
      map.remove();
    };
  }, [controls, globeRef, layerRef, handoverRef]);

  return (
    <>
      <div
        ref={containerRef}
        className="size-full [&_.maplibregl-ctrl-bottom-right]:bottom-[calc(100%-var(--map-sheet-top))]! md:[&_.maplibregl-ctrl-bottom-right]:bottom-0! short:[&_.maplibregl-ctrl-bottom-right]:right-80!"
        style={{
          backgroundColor: MAP_COLORS.background,
          ...getMapSheetTopStyle(phoneLayout, search.quake !== undefined),
        }}
      />
      {readyMap && <MapOverlay map={readyMap} />}
      {hovered && (
        <QuakeTooltip
          id={tooltipId}
          earthquake={hovered.earthquake}
          now={hovered.now}
          variant={variant}
          anchor={hovered.anchor}
          containerSize={hovered.containerSize}
          onOpen={() => selectQuake(hovered.earthquake)}
          getWheelTarget={() => mapRef.current?.getCanvas()}
          onPointerEnter={enterTooltip}
          onPointerLeave={leaveTooltip}
        />
      )}
    </>
  );
}
