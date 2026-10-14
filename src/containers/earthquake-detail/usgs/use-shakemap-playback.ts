import { useEffect, useState } from 'react';

import { useMediaQuery } from '@/hooks/use-media-query';
import {
  getAdvancedProgress,
  getInitialProgress,
  getPlayStartProgress,
} from '@/lib/shakemap/playback';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function useShakemapPlayback({
  canAutoplay,
  canAnimate,
}: {
  canAutoplay: boolean;
  canAnimate: boolean;
}) {
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const [progress, setProgress] = useState(() => getInitialProgress(reducedMotion));
  const [playing, setPlaying] = useState(false);
  const [hasAutoplayed, setHasAutoplayed] = useState(false);

  if (canAutoplay && !hasAutoplayed) {
    setHasAutoplayed(true);
    if (!reducedMotion) setPlaying(true);
  }
  if (playing && progress >= 1) setPlaying(false);

  function toggle() {
    if (playing) {
      setPlaying(false);
      return;
    }
    setProgress(getPlayStartProgress(progress));
    setPlaying(true);
  }

  function seek(value: number) {
    setPlaying(false);
    setProgress(value);
  }

  useEffect(() => {
    if (!playing || !canAnimate) return;
    let frame = 0;
    let previous = performance.now();
    function tick(now: number) {
      const elapsedMs = now - previous;
      previous = now;
      setProgress((current) => getAdvancedProgress(current, elapsedMs));
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, canAnimate]);

  return { progress, playing, toggle, seek };
}
