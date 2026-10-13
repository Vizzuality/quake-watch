import { describe, expect, it, vi } from 'vitest';

import { PLAYBACK_DURATION_MS } from '@/lib/earthquakes/timeline';

import { getPlaybackClock, getShouldPushT, T_PUSH_INTERVAL_MS } from './playback-clock';

function getHarness() {
  let nowMs = 0;
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  const clock = getPlaybackClock({
    now: () => nowMs,
    raf: (cb) => {
      const id = nextId++;
      callbacks.set(id, cb);
      return id;
    },
    cancelRaf: (id) => void callbacks.delete(id),
  });
  function advance(ms: number) {
    nowMs += ms;
    const pending = [...callbacks.values()];
    callbacks.clear();
    pending.forEach((cb) => cb(nowMs));
  }
  return { clock, advance, getPendingCount: () => callbacks.size };
}

const RANGE = { start: 1000, end: 61_000 };

describe('getPlaybackClock', () => {
  it('stores the playback range while paused and keeps it while playing', () => {
    const { clock } = getHarness();
    const listener = vi.fn<(t: number, playing: boolean) => void>();
    clock.subscribe(listener);
    clock.setRange(RANGE);
    expect(clock.getRange()).toEqual(RANGE);
    expect(listener).toHaveBeenCalledTimes(1);
    clock.play(RANGE);
    clock.setRange({ start: 0, end: 10 });
    expect(clock.getRange()).toEqual(RANGE);
  });

  it('setT jumps the playhead and keeps playing', () => {
    const { clock, advance } = getHarness();
    clock.play(RANGE);
    clock.setT(30_000);
    expect(clock.isPlaying()).toBe(true);
    expect(clock.getT()).toBe(30_000);
    advance(1000);
    expect(clock.getT()).toBeGreaterThan(30_000);
  });

  it('keeps setT inside the range while playing', () => {
    const { clock, advance } = getHarness();
    clock.play(RANGE);
    clock.setT(0);
    expect(clock.getT()).toBe(RANGE.start);
    advance(16);
    expect(clock.getT()).toBeGreaterThanOrEqual(RANGE.start);
  });

  it('advances t while playing', () => {
    const { clock, advance } = getHarness();
    clock.setT(RANGE.start);
    clock.play(RANGE);
    advance(PLAYBACK_DURATION_MS / 2);
    expect(clock.getT()).toBeCloseTo(31_000);
    expect(clock.isPlaying()).toBe(true);
  });

  it('reaches range.end after 30 s and pauses', () => {
    const { clock, advance } = getHarness();
    clock.play(RANGE);
    advance(PLAYBACK_DURATION_MS);
    expect(clock.getT()).toBe(RANGE.end);
    expect(clock.isPlaying()).toBe(false);
  });

  it('starts from range.start when t is outside the range', () => {
    const { clock } = getHarness();
    clock.setT(999_999);
    clock.play(RANGE);
    expect(clock.getT()).toBe(RANGE.start);
  });

  it('restarts from range.start when t is at range.end', () => {
    const { clock } = getHarness();
    clock.setT(RANGE.end);
    clock.play(RANGE);
    expect(clock.getT()).toBe(RANGE.start);
    expect(clock.isPlaying()).toBe(true);
  });

  it('continues from the current t when inside the range', () => {
    const { clock, advance } = getHarness();
    clock.setT(31_000);
    clock.play(RANGE);
    advance(PLAYBACK_DURATION_MS / 4);
    expect(clock.getT()).toBeCloseTo(46_000);
  });

  it('pause stops ticks', () => {
    const { clock, advance, getPendingCount } = getHarness();
    clock.play(RANGE);
    advance(5000);
    const t = clock.getT();
    clock.pause();
    expect(clock.isPlaying()).toBe(false);
    expect(getPendingCount()).toBe(0);
    advance(5000);
    expect(clock.getT()).toBe(t);
  });

  it('play while playing does not stack frames', () => {
    const { clock, getPendingCount } = getHarness();
    clock.play(RANGE);
    clock.play(RANGE);
    expect(getPendingCount()).toBe(1);
  });

  it('pause when idle is a no-op', () => {
    const { clock } = getHarness();
    const calls: number[] = [];
    clock.subscribe((t) => calls.push(t));
    clock.pause();
    expect(calls).toEqual([]);
  });

  it('notifies subscribers on ticks, setT, play and pause until unsubscribed', () => {
    const { clock, advance } = getHarness();
    const events: [number, boolean][] = [];
    const unsubscribe = clock.subscribe((t, playing) => events.push([t, playing]));
    clock.setT(2000);
    clock.play(RANGE);
    advance(1000);
    clock.pause();
    expect(events.length).toBeGreaterThanOrEqual(4);
    expect(events.at(-1)?.[1]).toBe(false);
    unsubscribe();
    const count = events.length;
    clock.setT(3000);
    expect(events).toHaveLength(count);
  });

  it('defaults to the global animation frame APIs', () => {
    const requested: FrameRequestCallback[] = [];
    const cancelled: number[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => requested.push(cb));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => cancelled.push(id));
    const clock = getPlaybackClock();
    clock.play(RANGE);
    expect(requested).toHaveLength(1);
    clock.pause();
    expect(cancelled).toEqual([1]);
    expect(clock.getT()).toBe(RANGE.start);
  });

  it('does not play a zero-span range', () => {
    const { clock, getPendingCount } = getHarness();
    clock.play({ start: 5, end: 5 });
    expect(clock.isPlaying()).toBe(false);
    expect(clock.getT()).toBe(5);
    expect(getPendingCount()).toBe(0);
  });
});

describe('getShouldPushT', () => {
  it('always pushes when not playing', () => {
    expect(getShouldPushT({ lastPushMs: 1000, nowMs: 1001, isPlaying: false })).toBe(true);
  });

  it('pushes when nothing was pushed yet', () => {
    expect(getShouldPushT({ lastPushMs: null, nowMs: 0, isPlaying: true })).toBe(true);
  });

  it('throttles while playing', () => {
    const lastPushMs = 1000;
    const early = lastPushMs + T_PUSH_INTERVAL_MS - 1;
    const due = lastPushMs + T_PUSH_INTERVAL_MS;
    expect(getShouldPushT({ lastPushMs, nowMs: early, isPlaying: true })).toBe(false);
    expect(getShouldPushT({ lastPushMs, nowMs: due, isPlaying: true })).toBe(true);
  });
});
