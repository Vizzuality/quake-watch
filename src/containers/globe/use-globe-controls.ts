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
  | { kind: 'pinch'; distance: number };
type Fly = { from: GlobeView; to: GlobeView; elapsedSeconds: number };

export type HoverOptions = { immediate?: boolean };

export type GlobeControlsOptions = {
  onTap?: (point: Point) => void;
  onHover?: (point: Point | null, options?: HoverOptions) => void;
};

const IMMEDIATE: HoverOptions = { immediate: true };

export type GlobeControls = {
  viewRef: RefObject<GlobeView>;
  advance: (dtSeconds: number, elapsedMs: number) => GlobeView;
  flyTo: (target: GlobeView) => void;
  setHeld: (held: boolean) => void;
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
  const viewRef = useRef<GlobeView>({ ...INITIAL_VIEW });
  const velocityRef = useRef<GlobeVelocity>(STOPPED);
  const isTouchedRef = useRef(false);
  const isHeldRef = useRef(false);
  const isReducedMotionRef = useRef(false);
  const gestureRef = useRef<Gesture | null>(null);
  const flyRef = useRef<Fly | null>(null);
  const optionsRef = useRef(options);

  const controls = useMemo<GlobeControls>(
    () => ({
      viewRef,
      flyTo: (target) => {
        optionsRef.current.onHover?.(null, IMMEDIATE);
        isTouchedRef.current = true;
        velocityRef.current = STOPPED;
        if (isReducedMotionRef.current) {
          flyRef.current = null;
          viewRef.current = target;
          return;
        }
        flyRef.current = { from: viewRef.current, to: target, elapsedSeconds: 0 };
      },
      setHeld: (held) => {
        isHeldRef.current = held;
      },
      advance: (dtSeconds, elapsedMs) => {
        const fly = flyRef.current;
        if (fly) {
          const next = advanceFly(fly, dtSeconds);
          viewRef.current = next.view;
          if (next.done) flyRef.current = null;
          return next.view;
        }
        const dt = Math.min(dtSeconds, MAX_FRAME_SECONDS);
        const view = viewRef.current;
        if (gestureRef.current || isReducedMotionRef.current) {
          velocityRef.current = STOPPED;
          return view;
        }
        if (hasVelocity(velocityRef.current)) {
          const next = getInertiaView(view, velocityRef.current, dt);
          viewRef.current = next.view;
          velocityRef.current = next.velocity;
        } else if (!isTouchedRef.current && !isHeldRef.current) {
          viewRef.current = { ...view, lon: getIdleDriftLon(view.lon, dt, elapsedMs) };
        }
        return viewRef.current;
      },
    }),
    [],
  );

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
      isTapCandidate = false;
      gestureRef.current = { kind: 'pinch', distance: getDistance([...pointers.values()]) };
    }

    function handlePointerDown(event: PointerEvent) {
      if (pointers.size >= 2) return;
      optionsRef.current.onHover?.(null, IMMEDIATE);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      velocityRef.current = STOPPED;
      flyRef.current = null;
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
          viewRef.current = getZoomedView(
            viewRef.current,
            getPinchFactor(distance, gesture.distance),
          );
          isTouchedRef.current = true;
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
    }

    function handlePointerEnd(event: PointerEvent) {
      if (!pointers.delete(event.pointerId)) return;
      const gesture = gestureRef.current;
      element.style.cursor = '';
      if (gesture?.kind === 'pinch') {
        const [remaining] = pointers.values();
        gestureRef.current = null;
        if (remaining) startDrag(remaining);
        return;
      }
      gestureRef.current = null;
      if (event.type !== 'pointerup') return;
      if (isTapCandidate && !gesture?.moved) {
        optionsRef.current.onTap?.(getRelativePoint(element, event));
      }
      if (gesture?.moved && !isReducedMotionRef.current) {
        velocityRef.current = getReleaseVelocity(samples, event.timeStamp);
      }
    }

    function handlePointerLeave() {
      optionsRef.current.onHover?.(null);
    }

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      optionsRef.current.onHover?.(null, IMMEDIATE);
      flyRef.current = null;
      viewRef.current = getZoomedView(viewRef.current, getWheelFactor(event.deltaY));
      isTouchedRef.current = true;
      const [point] = pointers.values();
      if (gestureRef.current?.kind === 'drag' && point) startDrag(point, gestureRef.current.moved);
    }

    function handleReducedMotionChange(event: MediaQueryListEvent) {
      isReducedMotionRef.current = event.matches;
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
