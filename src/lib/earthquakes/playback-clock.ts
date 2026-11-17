import { type TimeRange, getPlaybackSpeed } from './timeline';

export type PlaybackSnapshot = {
  isPlaying: boolean;
  playhead: number | null;
  range: TimeRange | null;
};

export type PlaybackClockEnvironment = {
  now: () => number;
  requestFrame: (callback: () => void) => number;
  cancelFrame: (id: number) => void;
  isReducedMotion: () => boolean;
};

export type PlaybackClock = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => PlaybackSnapshot;
  subscribeFrame: (listener: () => void) => () => void;
  getPlayhead: () => number | null;
  isStepped: () => boolean;
  getFinishedAt: () => number | null;
  setRange: (range: TimeRange | null) => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  goLive: () => void;
};

export const REDUCED_MOTION_STEP_MS = 2000;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const LIVE_SNAPSHOT: PlaybackSnapshot = { isPlaying: false, playhead: null, range: null };

function getSpan(range: TimeRange | null): number {
  return range ? range.end - range.start : Number.NaN;
}

function getElapsedMs(elapsedMs: number, isStepped: boolean): number {
  if (!isStepped) return elapsedMs;
  return Math.floor(elapsedMs / REDUCED_MOTION_STEP_MS) * REDUCED_MOTION_STEP_MS;
}

function getClampedTime(time: number, range: TimeRange): number {
  return Math.min(range.end, Math.max(range.start, time));
}

function getSeekPlayhead(time: number, range: TimeRange): number | null {
  const clamped = getClampedTime(time, range);
  return clamped >= range.end ? null : clamped;
}

export function createPlaybackClock(environment: PlaybackClockEnvironment): PlaybackClock {
  const listeners = new Set<() => void>();
  const frameListeners = new Set<() => void>();
  let snapshot = LIVE_SNAPSHOT;
  let playhead: number | null = null;
  let frameId: number | null = null;
  let stepped = false;
  let run = { startTime: 0, startedAt: 0 };
  let finishedAt: number | null = null;

  function emitFrame() {
    for (const listener of frameListeners) listener();
  }

  function commit(next: Partial<PlaybackSnapshot>, finished: number | null = null) {
    finishedAt = finished;
    snapshot = { ...snapshot, ...next, playhead };
    for (const listener of listeners) listener();
    emitFrame();
  }

  function stopFrames() {
    if (frameId !== null) environment.cancelFrame(frameId);
    frameId = null;
  }

  function tick() {
    frameId = null;
    const { range } = snapshot;
    if (!range || !snapshot.isPlaying) return;
    const elapsedMs = getElapsedMs(environment.now() - run.startedAt, stepped);
    const next = run.startTime + elapsedMs * getPlaybackSpeed(range);
    if (next >= range.end) {
      playhead = null;
      commit({ isPlaying: false }, range.end);
      return;
    }
    if (next !== playhead) {
      playhead = next;
      emitFrame();
    }
    frameId = environment.requestFrame(tick);
  }

  function play() {
    const { range } = snapshot;
    if (!range || snapshot.isPlaying) return;
    const startTime = playhead === null || playhead >= range.end ? range.start : playhead;
    stepped = environment.isReducedMotion();
    run = { startTime, startedAt: environment.now() };
    playhead = startTime;
    commit({ isPlaying: true });
    frameId = environment.requestFrame(tick);
  }

  function pause() {
    if (!snapshot.isPlaying) return;
    stopFrames();
    commit({ isPlaying: false });
  }

  function seek(time: number) {
    const { range } = snapshot;
    if (!range) return;
    stopFrames();
    playhead = getSeekPlayhead(time, range);
    commit({ isPlaying: false });
  }

  function goLive() {
    if (playhead === null && !snapshot.isPlaying) return;
    stopFrames();
    playhead = null;
    commit({ isPlaying: false });
  }

  function setRange(range: TimeRange | null) {
    const current = snapshot.range;
    if (current?.start === range?.start && current?.end === range?.end) return;
    if (!range || getSpan(range) !== getSpan(current)) {
      stopFrames();
      playhead = null;
      commit({ range, isPlaying: false });
      return;
    }
    if (playhead !== null) playhead = getClampedTime(playhead, range);
    commit({ range });
  }

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    subscribeFrame: (listener) => {
      frameListeners.add(listener);
      return () => frameListeners.delete(listener);
    },
    getPlayhead: () => playhead,
    isStepped: () => stepped && (snapshot.isPlaying || finishedAt !== null),
    getFinishedAt: () => finishedAt,
    setRange,
    play,
    pause,
    seek,
    goLive,
  };
}

export function getLiveSnapshot(): PlaybackSnapshot {
  return LIVE_SNAPSHOT;
}

export const playbackClock = createPlaybackClock({
  now: () => performance.now(),
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (id) => cancelAnimationFrame(id),
  isReducedMotion: () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
});
