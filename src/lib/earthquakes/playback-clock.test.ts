import { describe, expect, it, vi } from 'vitest';

import { REDUCED_MOTION_STEP_MS, createPlaybackClock } from './playback-clock';
import { getShownCount } from './timeline';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const RANGE = { start: 10 * DAY, end: 11 * DAY };

function getTestClock({ reducedMotion = false } = {}) {
  let now = 0;
  let frames: (() => void)[] = [];
  const clock = createPlaybackClock({
    now: () => now,
    requestFrame: (callback) => frames.push(callback),
    cancelFrame: () => {
      frames = [];
    },
    isReducedMotion: () => reducedMotion,
  });

  function advance(ms: number) {
    now += ms;
    const due = frames;
    frames = [];
    for (const frame of due) frame();
  }

  return { clock, advance, getPendingFrames: () => frames.length };
}

describe('createPlaybackClock', () => {
  it('starts live at the end with no autoplay', () => {
    const { clock, getPendingFrames } = getTestClock();
    clock.setRange(RANGE);

    expect(clock.getPlayhead()).toBeNull();
    expect(clock.getSnapshot()).toEqual({ isPlaying: false, playhead: null, range: RANGE });
    expect(getPendingFrames()).toBe(0);
  });

  it('plays the whole interval in 48 s from the start, then returns to live', () => {
    const { clock, advance } = getTestClock();
    clock.setRange(RANGE);

    clock.play();
    expect(clock.getPlayhead()).toBe(RANGE.start);
    advance(24_000);
    expect(clock.getPlayhead()).toBe(RANGE.start + 12 * HOUR);
    advance(23_000);
    expect(clock.getSnapshot().isPlaying).toBe(true);
    advance(1000);
    expect(clock.getPlayhead()).toBeNull();
    expect(clock.getSnapshot().isPlaying).toBe(false);
  });

  it('notifies status listeners on play and pause only, frame listeners every frame', () => {
    const { clock, advance } = getTestClock();
    clock.setRange(RANGE);
    const onStatus = vi.fn<() => void>();
    const onFrame = vi.fn<() => void>();
    clock.subscribe(onStatus);
    clock.subscribeFrame(onFrame);

    clock.play();
    for (let i = 0; i < 30; i++) advance(16);
    clock.pause();

    expect(onStatus).toHaveBeenCalledTimes(2);
    expect(onFrame).toHaveBeenCalledTimes(32);
  });

  it('resumes from the paused playhead', () => {
    const { clock, advance } = getTestClock();
    clock.setRange(RANGE);

    clock.play();
    advance(2000);
    clock.pause();
    const paused = clock.getPlayhead();
    advance(10_000);
    expect(clock.getPlayhead()).toBe(paused);
    clock.play();
    advance(2000);

    expect(clock.getPlayhead()).toBe(RANGE.start + 2 * HOUR);
  });

  it('restarts from the beginning when played at the end', () => {
    const { clock } = getTestClock();
    clock.setRange(RANGE);
    clock.seek(RANGE.end);

    clock.play();

    expect(clock.getPlayhead()).toBe(RANGE.start);
  });

  it('seeks within the range and pauses', () => {
    const { clock, advance } = getTestClock();
    clock.setRange(RANGE);
    clock.play();

    clock.seek(RANGE.start - DAY);
    expect(clock.getPlayhead()).toBe(RANGE.start);
    clock.seek(RANGE.start + HOUR);
    advance(5000);

    expect(clock.getSnapshot()).toMatchObject({ isPlaying: false, playhead: RANGE.start + HOUR });
  });

  it('goes live on a seek to the end, so a refetch keeps showing new Earthquakes', () => {
    const { clock } = getTestClock();
    clock.setRange(RANGE);
    clock.seek(RANGE.start + HOUR);

    clock.seek(RANGE.end);
    expect(clock.getPlayhead()).toBeNull();
    clock.setRange({ start: RANGE.start + 60_000, end: RANGE.end + 60_000 });

    expect(getShownCount([RANGE.end + 30_000], clock.getPlayhead())).toBe(1);
  });

  it('goes live and stops on demand', () => {
    const { clock, getPendingFrames } = getTestClock();
    clock.setRange(RANGE);
    const onStatus = vi.fn<() => void>();
    clock.subscribe(onStatus);
    clock.goLive();
    expect(onStatus).not.toHaveBeenCalled();

    clock.play();
    clock.goLive();

    expect(clock.getSnapshot()).toMatchObject({ isPlaying: false, playhead: null });
    expect(getPendingFrames()).toBe(0);
  });

  it('remembers the end of a run that finished until the next change', () => {
    const { clock, advance } = getTestClock({ reducedMotion: true });
    clock.setRange(RANGE);
    clock.play();
    expect(clock.getFinishedAt()).toBeNull();

    advance(48_000);
    expect(clock.getFinishedAt()).toBe(RANGE.end);
    expect(clock.isStepped()).toBe(true);
    clock.seek(RANGE.start);

    expect(clock.getFinishedAt()).toBeNull();
    expect(clock.isStepped()).toBe(false);
  });

  it('ignores play, pause and seek without a range', () => {
    const { clock } = getTestClock();
    const onStatus = vi.fn<() => void>();
    clock.subscribe(onStatus);

    clock.play();
    clock.pause();
    clock.seek(5);

    expect(onStatus).not.toHaveBeenCalled();
    expect(clock.getPlayhead()).toBeNull();
  });

  it('keeps a paused playhead when a refetch shifts the range', () => {
    const { clock } = getTestClock();
    clock.setRange(RANGE);
    clock.seek(RANGE.start + HOUR);

    clock.setRange({ start: RANGE.start + 2 * HOUR, end: RANGE.end + 2 * HOUR });

    expect(clock.getPlayhead()).toBe(RANGE.start + 2 * HOUR);
  });

  it('returns to live when the interval changes', () => {
    const { clock } = getTestClock();
    clock.setRange(RANGE);
    clock.play();

    clock.setRange({ start: RANGE.end - 7 * DAY, end: RANGE.end });

    expect(clock.getSnapshot()).toMatchObject({ isPlaying: false, playhead: null });
  });

  it('does not notify for the same range', () => {
    const { clock } = getTestClock();
    clock.setRange(RANGE);
    const onStatus = vi.fn<() => void>();
    clock.subscribe(onStatus);

    clock.setRange({ ...RANGE });

    expect(onStatus).not.toHaveBeenCalled();
  });

  it('stops notifying after unsubscribe', () => {
    const { clock } = getTestClock();
    const onStatus = vi.fn<() => void>();
    const onFrame = vi.fn<() => void>();
    clock.subscribe(onStatus)();
    clock.subscribeFrame(onFrame)();

    clock.setRange(RANGE);

    expect(onStatus).not.toHaveBeenCalled();
    expect(onFrame).not.toHaveBeenCalled();
  });

  it('advances in 2 s steps under reduced motion', () => {
    const { clock, advance } = getTestClock({ reducedMotion: true });
    clock.setRange(RANGE);
    const onFrame = vi.fn<() => void>();
    clock.play();
    clock.subscribeFrame(onFrame);

    expect(clock.isStepped()).toBe(true);
    for (let i = 0; i < 100; i++) advance(REDUCED_MOTION_STEP_MS / 50);

    expect(clock.getPlayhead()).toBe(RANGE.start + 2 * HOUR);
    expect(onFrame).toHaveBeenCalledTimes(2);
  });

  it('is not stepped while paused', () => {
    const { clock } = getTestClock({ reducedMotion: true });
    clock.setRange(RANGE);

    expect(clock.isStepped()).toBe(false);
  });
});
