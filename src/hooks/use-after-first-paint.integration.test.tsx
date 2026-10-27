import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';

import { useAfterFirstPaint } from './use-after-first-paint';

function stubAnimationFrames() {
  const frames = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  const cancelAnimationFrame = vi.fn<(id: number) => boolean>((id) => frames.delete(id));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextId++;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);
  function flushFrames() {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(performance.now());
  }
  return { flushFrames, cancelAnimationFrame };
}

function waitForTask() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('useAfterFirstPaint', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is false on the first render', async () => {
    const values: boolean[] = [];
    await renderHook(() => {
      const painted = useAfterFirstPaint();
      values.push(painted);
      return painted;
    });

    expect(values[0]).toBe(false);
  });

  it('turns true once a frame has been painted', async () => {
    const { result } = await renderHook(() => useAfterFirstPaint());

    await expect.poll(() => result.current).toBe(true);
  });

  it('stays false until two frames run, then waits one task', async () => {
    const { flushFrames } = stubAnimationFrames();
    const { result } = await renderHook(() => useAfterFirstPaint());

    await waitForTask();
    await waitForTask();
    expect(result.current).toBe(false);

    flushFrames();
    await waitForTask();
    expect(result.current).toBe(false);

    flushFrames();
    expect(result.current).toBe(false);
    await expect.poll(() => result.current).toBe(true);
  });

  it('cancels the pending frame on unmount', async () => {
    const { cancelAnimationFrame } = stubAnimationFrames();
    const { unmount } = await renderHook(() => useAfterFirstPaint());

    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledOnce();
  });

  it('cancels the pending task on unmount', async () => {
    const { flushFrames } = stubAnimationFrames();
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { result, unmount } = await renderHook(() => useAfterFirstPaint());

    flushFrames();
    flushFrames();
    unmount();
    await waitForTask();

    expect(clearTimeoutSpy).toHaveBeenCalledOnce();
    expect(result.current).toBe(false);
  });
});
