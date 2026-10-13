import { PLAYBACK_DURATION_MS, getPlaybackT } from '@/lib/earthquakes/timeline';
import type { TimeRange } from '@/lib/earthquakes/timeline';

type Listener = (t: number, playing: boolean) => void;

export type PlaybackClock = {
  getT(): number;
  getRange(): TimeRange;
  isPlaying(): boolean;
  setRange(range: TimeRange): void;
  setT(t: number): void;
  play(range: TimeRange): void;
  pause(): void;
  subscribe(listener: Listener): () => void;
};

type ClockDeps = {
  now?: () => number;
  raf?: (cb: FrameRequestCallback) => number;
  cancelRaf?: (id: number) => void;
};

export const T_PUSH_INTERVAL_MS = 250;

export function getShouldPushT(input: {
  lastPushMs: number | null;
  nowMs: number;
  isPlaying: boolean;
}): boolean {
  const { lastPushMs, nowMs, isPlaying } = input;
  if (!isPlaying || lastPushMs === null) return true;
  return nowMs - lastPushMs >= T_PUSH_INTERVAL_MS;
}

export function getPlaybackClock(deps: ClockDeps = {}): PlaybackClock {
  const now = deps.now ?? (() => performance.now());
  const raf = deps.raf ?? ((cb) => requestAnimationFrame(cb));
  const cancelRaf = deps.cancelRaf ?? ((id) => cancelAnimationFrame(id));
  const listeners = new Set<Listener>();
  let t = 0;
  let playing = false;
  let range: TimeRange = { start: 0, end: 0 };
  let anchorMs = 0;
  let anchorElapsedMs = 0;
  let frameId: number | null = null;

  function notify() {
    listeners.forEach((listener) => listener(t, playing));
  }

  function setAnchor() {
    const span = range.end - range.start;
    anchorMs = now();
    anchorElapsedMs = span > 0 ? ((t - range.start) * PLAYBACK_DURATION_MS) / span : 0;
  }

  function stopFrame() {
    if (frameId !== null) cancelRaf(frameId);
    frameId = null;
  }

  function tick() {
    frameId = null;
    t = getPlaybackT({ range, elapsedMs: anchorElapsedMs + now() - anchorMs });
    playing = t < range.end;
    if (playing) frameId = raf(tick);
    notify();
  }

  return {
    getT: () => t,
    getRange: () => range,
    isPlaying: () => playing,
    setRange(next) {
      if (playing) return;
      range = next;
      notify();
    },
    setT(next) {
      t = playing ? Math.min(Math.max(next, range.start), range.end) : next;
      if (playing) setAnchor();
      notify();
    },
    play(next) {
      stopFrame();
      range = next;
      const isInside = t >= range.start && t < range.end;
      t = isInside ? t : range.start;
      playing = range.end > range.start;
      if (!playing) t = range.end;
      setAnchor();
      if (playing) frameId = raf(tick);
      notify();
    },
    pause() {
      if (!playing) return;
      stopFrame();
      playing = false;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
