import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runAfterFirstPaint } from './after-first-paint';

const frames = new Map<number, FrameRequestCallback>();

function flushFrames() {
  const pending = [...frames.values()];
  frames.clear();
  for (const callback of pending) callback(0);
}

describe('runAfterFirstPaint', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    let nextId = 1;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(nextId, callback);
      return nextId++;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  });

  afterEach(() => {
    frames.clear();
    vi.useRealTimers();
  });

  it('runs the task one task after the second frame', () => {
    const task = vi.fn<() => void>();
    runAfterFirstPaint(task);

    vi.runAllTimers();
    expect(task).not.toHaveBeenCalled();

    flushFrames();
    vi.runAllTimers();
    expect(task).not.toHaveBeenCalled();

    flushFrames();
    expect(task).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(task).toHaveBeenCalledOnce();
  });

  it('never runs the task when cancelled before the frame', () => {
    const task = vi.fn<() => void>();
    const cancel = runAfterFirstPaint(task);

    cancel();
    flushFrames();
    flushFrames();
    vi.runAllTimers();

    expect(task).not.toHaveBeenCalled();
  });

  it('never runs the task when cancelled between the two frames', () => {
    const task = vi.fn<() => void>();
    const cancel = runAfterFirstPaint(task);

    flushFrames();
    cancel();
    flushFrames();
    vi.runAllTimers();

    expect(task).not.toHaveBeenCalled();
  });

  it('never runs the task when cancelled between the second frame and the task', () => {
    const task = vi.fn<() => void>();
    const cancel = runAfterFirstPaint(task);

    flushFrames();
    flushFrames();
    cancel();
    vi.runAllTimers();

    expect(task).not.toHaveBeenCalled();
  });
});
