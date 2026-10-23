import { type RefObject, useEffect, useState } from 'react';

import { useMediaQuery } from '@/hooks/use-media-query';
import { usePageVisible, useViewportVisibility } from '@/hooks/use-visibility';
import { TRAIN_CROSS_MS } from '@/lib/shakemap/wave-train';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const FROZEN_ELAPSED_MS = TRAIN_CROSS_MS * 0.6;

function getInitialElapsedMs(frozen: boolean): number {
  return frozen ? FROZEN_ELAPSED_MS : 0;
}

export function useWaveLoop(ref: RefObject<Element | null>) {
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const { isVisible } = useViewportVisibility(ref);
  const pageVisible = usePageVisible();
  const [playing, setPlaying] = useState(!reducedMotion);
  const [toggled, setToggled] = useState(false);
  const frozen = reducedMotion && !toggled;
  const running = playing && isVisible && pageVisible;

  if (frozen && playing) setPlaying(false);

  function toggle() {
    setToggled(true);
    setPlaying((current) => !current);
  }

  return { playing, running, frozen, toggle };
}

export function useWaveClock(running: boolean, frozen: boolean): number {
  const [elapsedMs, setElapsedMs] = useState(() => getInitialElapsedMs(frozen));
  const [wasFrozen, setWasFrozen] = useState(frozen);

  if (frozen !== wasFrozen) {
    setWasFrozen(frozen);
    if (frozen) setElapsedMs(FROZEN_ELAPSED_MS);
  }

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let previous = performance.now();
    function tick(now: number) {
      const delta = Math.max(0, now - previous);
      previous = now;
      setElapsedMs((current) => current + delta);
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);

  return elapsedMs;
}
