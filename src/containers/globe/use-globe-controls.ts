import { invalidate } from '@react-three/fiber';
import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import { getGlobeFrame } from '@/lib/globe/frame';
import {
  FLY_DURATION_MS,
  type GlobeVelocity,
  type GlobeView,
  INITIAL_VIEW,
  STOPPED,
  getDraggedView,
  getFlyView,
  getIdleDriftLon,
  getInertiaView,
  getPinchFactor,
  getWheelFactor,
  ZOOM_RANGE,
  getZoomedView,
} from '@/lib/globe/motion';

const DRAG_THRESHOLD_PX = 4;
const MAX_FRAME_SECONDS = 0.1;
const RELEASE_WINDOW_MS = 100;
const RELEASE_PAUSE_MS = 50;
const RELEASE_MIN_SPAN_MS = 16;
export const MAX_RELEASE_SPEED = 3;
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

type Point = { x: number; y: number };
type Sample = { time: number; lon: number; lat: number };
type Gesture =
  | { kind: 'drag'; origin: Point; start: GlobeView; radius: number; moved: boolean }
  | { kind: 'pinch'; distance: number; changed: boolean };
type Fly = { from: GlobeView; to: GlobeView; elapsedSeconds: number; isFraming: boolean };

export type HoverOptions = { immediate?: boolean };

export type GlobeControlsOptions = {
  initialView?: GlobeView;
  onTap?: (point: Point) => void;
  onHover?: (point: Point | null, options?: HoverOptions) => void;
  onSettle?: (view: GlobeView) => void;
  onZoomPastMax?: (view: GlobeView) => void;
  onZoom?: (view: GlobeView) => void;
};

const IMMEDIATE: HoverOptions = { immediate: true };

export type GlobeControls = {
  viewRef: RefObject<GlobeView>;
  advance: (dtSeconds: number, elapsedMs: number) => GlobeView;
  flyTo: (target: GlobeView) => void;
  frameTo: (target: GlobeView) => void;
  jumpTo: (target: GlobeView) => void;
  setHeld: (held: boolean) => void;
  setFrameListener: (listener: ((view: GlobeView) => void) | null) => void;
  isAnimating: () => boolean;
};

function hasVelocity(velocity: GlobeVelocity): boolean {
  return velocity.lon !== 0 || velocity.lat !== 0;
}

function getDistance(points: Point[]): number {
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function getReleaseVelocity(samples: Sample[], releaseTime: number): GlobeVelocity {
  const recent = samples.filter((sample) => sample.time >= releaseTime - RELEASE_WINDOW_MS);
  const first = recent.at(0);
  const last = recent.at(-1);
  if (!first || !last || first === last) return STOPPED;
  if (releaseTime - last.time > RELEASE_PAUSE_MS) return STOPPED;
  const seconds = Math.max(last.time - first.time, RELEASE_MIN_SPAN_MS) / 1000;
  const lon = (last.lon - first.lon) / seconds;
  const lat = (last.lat - first.lat) / seconds;
  const scale = Math.min(1, MAX_RELEASE_SPEED / Math.hypot(lon, lat));
  return { lon: lon * scale, lat: lat * scale };
}

function getRelativePoint(element: HTMLElement, event: PointerEvent): Point {
  const rect = element.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function advanceFly(fly: Fly, dtSeconds: number): { view: GlobeView; done: boolean } {
  fly.elapsedSeconds += dtSeconds;
  const progress = (fly.elapsedSeconds * 1000) / FLY_DURATION_MS;
  if (progress >= 1) return { view: fly.to, done: true };
  return { view: getFlyView(fly.from, fly.to, progress), done: false };
}

export function useGlobeControls(
  targetRef: RefObject<HTMLElement | null>,
  options: GlobeControlsOptions = {},
): GlobeControls {
  const viewRef = useRef<GlobeView>({ ...(options.initialView ?? INITIAL_VIEW) });
  const velocityRef = useRef<GlobeVelocity>(STOPPED);
  const isTouchedRef = useRef(options.initialView !== undefined);
  const isHeldRef = useRef(false);
  const isReducedMotionRef = useRef(false);
  const gestureRef = useRef<Gesture | null>(null);
  const flyRef = useRef<Fly | null>(null);
  const optionsRef = useRef(options);
  const frameListenerRef = useRef<((view: GlobeView) => void) | null>(null);

  const controls = useMemo<GlobeControls>(() => {
    function getNextView(dtSeconds: number, elapsedMs: number): GlobeView {
      const fly = flyRef.current;
      if (fly) {
        const next = advanceFly(fly, dtSeconds);
        viewRef.current = next.view;
        if (next.done) flyRef.current = null;
        if (next.done && !fly.isFraming) optionsRef.current.onSettle?.(next.view);
        return next.view;
      }
      const dt = Math.min(dtSeconds, MAX_FRAME_SECONDS);
      const view = viewRef.current;
      const isCoasting = hasVelocity(velocityRef.current);
      if (gestureRef.current || isReducedMotionRef.current) {
        velocityRef.current = STOPPED;
        if (isCoasting) optionsRef.current.onSettle?.(view);
        return view;
      }
      if (isCoasting) {
        const next = getInertiaView(view, velocityRef.current, dt);
        viewRef.current = next.view;
        velocityRef.current = next.velocity;
        if (!hasVelocity(next.velocity)) optionsRef.current.onSettle?.(next.view);
      } else if (!isTouchedRef.current && !isHeldRef.current) {
        viewRef.current = { ...view, lon: getIdleDriftLon(view.lon, dt, elapsedMs) };
      }
      return viewRef.current;
    }

    return {
      viewRef,
      flyTo: (target) => {
        optionsRef.current.onHover?.(null, IMMEDIATE);
        isTouchedRef.current = true;
        velocityRef.current = STOPPED;
        if (isReducedMotionRef.current) {
          flyRef.current = null;
          viewRef.current = target;
          invalidate();
          optionsRef.current.onSettle?.(target);
          return;
        }
        flyRef.current = { from: viewRef.current, to: target, elapsedSeconds: 0, isFraming: false };
        invalidate();
      },
      frameTo: (target) => {
        if (isTouchedRef.current || gestureRef.current || flyRef.current) return;
        if (hasVelocity(velocityRef.current)) return;
        optionsRef.current.onHover?.(null, IMMEDIATE);
        if (isReducedMotionRef.current) {
          viewRef.current = target;
          invalidate();
          return;
        }
        flyRef.current = { from: viewRef.current, to: target, elapsedSeconds: 0, isFraming: true };
        invalidate();
      },
      jumpTo: (target) => {
        isTouchedRef.current = true;
        velocityRef.current = STOPPED;
        flyRef.current = null;
        viewRef.current = target;
        invalidate();
        optionsRef.current.onSettle?.(target);
      },
      setHeld: (held) => {
        const wasHeld = isHeldRef.current;
        isHeldRef.current = held;
        if (wasHeld && !held) invalidate();
      },
      isAnimating: () => {
        if (flyRef.current || hasVelocity(velocityRef.current)) return true;
        if (gestureRef.current || isTouchedRef.current || isHeldRef.current) return false;
        return !isReducedMotionRef.current;
      },
      setFrameListener: (listener) => {
        frameListenerRef.current = listener;
      },
      advance: (dtSeconds, elapsedMs) => {
        const view = getNextView(dtSeconds, elapsedMs);
        frameListenerRef.current?.(view);
        return view;
      },
    };
  }, []);

  useLayoutEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;
    const element: HTMLElement = target;
    const pointers = new Map<number, Point>();
    let samples: Sample[] = [];
    let isTapCandidate = false;
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    isReducedMotionRef.current = reducedMotion.matches;

    function startDrag(origin: Point, moved = false) {
      samples = [];
      gestureRef.current = {
        kind: 'drag',
        origin,
        start: viewRef.current,
        radius: getGlobeFrame(element.clientWidth, element.clientHeight).radius,
        moved,
      };
    }

    function startPinch() {
      const previous = gestureRef.current;
      isTapCandidate = false;
      gestureRef.current = {
        kind: 'pinch',
        distance: getDistance([...pointers.values()]),
        changed: previous?.kind === 'drag' && previous.moved,
      };
    }

    function handlePointerDown(event: PointerEvent) {
      if (pointers.size >= 2) return;
      optionsRef.current.onHover?.(null, IMMEDIATE);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const fly = flyRef.current;
      const isCoasting = hasVelocity(velocityRef.current);
      velocityRef.current = STOPPED;
      flyRef.current = null;
      if (fly?.isFraming) isTouchedRef.current = true;
      else if (fly || isCoasting) optionsRef.current.onSettle?.(viewRef.current);
      isTapCandidate = pointers.size === 1 && event.button === 0;
      element.setPointerCapture(event.pointerId);
      if (pointers.size === 2) startPinch();
      else startDrag({ x: event.clientX, y: event.clientY });
    }

    function handlePointerMove(event: PointerEvent) {
      const gesture = gestureRef.current;
      if (!gesture && (flyRef.current || hasVelocity(velocityRef.current))) {
        optionsRef.current.onHover?.(null, IMMEDIATE);
        return;
      }
      if (!gesture) {
        optionsRef.current.onHover?.(getRelativePoint(element, event));
        return;
      }
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (gesture.kind === 'pinch') {
        const distance = getDistance([...pointers.values()]);
        if (gesture.distance > 0) {
          const { zoom } = viewRef.current;
          const factor = getPinchFactor(distance, gesture.distance);
          if (factor > 1 && zoom >= ZOOM_RANGE[1]) {
            velocityRef.current = STOPPED;
            optionsRef.current.onZoomPastMax?.(viewRef.current);
          }
          viewRef.current = getZoomedView(viewRef.current, factor);
          isTouchedRef.current = true;
          if (viewRef.current.zoom !== zoom) {
            gesture.changed = true;
            invalidate();
            optionsRef.current.onZoom?.(viewRef.current);
          }
        }
        gesture.distance = distance;
        return;
      }
      const dx = event.clientX - gesture.origin.x;
      const dy = event.clientY - gesture.origin.y;
      if (!gesture.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD_PX) return;
      if (!gesture.moved) {
        gesture.moved = true;
        isTapCandidate = false;
        isTouchedRef.current = true;
        element.style.cursor = 'grabbing';
      }
      viewRef.current = getDraggedView(gesture.start, dx, dy, gesture.radius);
      const { lon, lat } = viewRef.current;
      samples.push({ time: event.timeStamp, lon, lat });
      invalidate();
    }

    function handlePointerEnd(event: PointerEvent) {
      if (!pointers.delete(event.pointerId)) return;
      const gesture = gestureRef.current;
      element.style.cursor = '';
      invalidate();
      if (gesture?.kind === 'pinch') {
        const [remaining] = pointers.values();
        gestureRef.current = null;
        if (gesture.changed) optionsRef.current.onSettle?.(viewRef.current);
        if (remaining) startDrag(remaining);
        return;
      }
      gestureRef.current = null;
      if (event.type !== 'pointerup') {
        if (gesture?.moved) optionsRef.current.onSettle?.(viewRef.current);
        return;
      }
      if (isTapCandidate && !gesture?.moved) {
        optionsRef.current.onTap?.(getRelativePoint(element, event));
      }
      if (gesture?.moved && !isReducedMotionRef.current) {
        velocityRef.current = getReleaseVelocity(samples, event.timeStamp);
      }
      if (gesture?.moved && !hasVelocity(velocityRef.current)) {
        optionsRef.current.onSettle?.(viewRef.current);
      }
    }

    function handlePointerLeave() {
      optionsRef.current.onHover?.(null);
    }

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      optionsRef.current.onHover?.(null, IMMEDIATE);
      flyRef.current = null;
      if (event.deltaY < 0 && viewRef.current.zoom >= ZOOM_RANGE[1]) {
        velocityRef.current = STOPPED;
        optionsRef.current.onZoomPastMax?.(viewRef.current);
      }
      viewRef.current = getZoomedView(viewRef.current, getWheelFactor(event.deltaY));
      isTouchedRef.current = true;
      invalidate();
      optionsRef.current.onZoom?.(viewRef.current);
      optionsRef.current.onSettle?.(viewRef.current);
      const [point] = pointers.values();
      if (gestureRef.current?.kind === 'drag' && point) startDrag(point, gestureRef.current.moved);
    }

    function handleReducedMotionChange(event: MediaQueryListEvent) {
      isReducedMotionRef.current = event.matches;
      invalidate();
    }

    element.addEventListener('pointerdown', handlePointerDown);
    element.addEventListener('pointermove', handlePointerMove);
    element.addEventListener('pointerup', handlePointerEnd);
    element.addEventListener('pointercancel', handlePointerEnd);
    element.addEventListener('pointerleave', handlePointerLeave);
    element.addEventListener('wheel', handleWheel, { passive: false });
    reducedMotion.addEventListener('change', handleReducedMotionChange);
    return () => {
      element.removeEventListener('pointerdown', handlePointerDown);
      element.removeEventListener('pointermove', handlePointerMove);
      element.removeEventListener('pointerup', handlePointerEnd);
      element.removeEventListener('pointercancel', handlePointerEnd);
      element.removeEventListener('pointerleave', handlePointerLeave);
      element.removeEventListener('wheel', handleWheel);
      reducedMotion.removeEventListener('change', handleReducedMotionChange);
    };
  }, [targetRef]);

  return controls;
}
