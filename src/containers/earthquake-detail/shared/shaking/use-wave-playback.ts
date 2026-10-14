import { useEffect, useState } from 'react';

import { useMediaQuery } from '@/hooks/use-media-query';
import {
  getAdvancedSeconds,
  getInitialSeconds,
  getPlayStartSeconds,
} from '@/lib/shakemap/playback';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function useWavePlayback({
  durationSeconds,
  canAutoplay,
  canAnimate,
}: {
  durationSeconds: number;
  canAutoplay: boolean;
  canAnimate: boolean;
}) {
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const [seconds, setSeconds] = useState(() => getInitialSeconds(reducedMotion, durationSeconds));
  const [playing, setPlaying] = useState(false);
  const [hasAutoplayed, setHasAutoplayed] = useState(false);
  const complete = seconds >= durationSeconds;

  if (canAutoplay && !hasAutoplayed) {
    setHasAutoplayed(true);
    if (!reducedMotion) setPlaying(true);
  }
  if (playing && complete) setPlaying(false);

  function toggle() {
    if (playing) {
      setPlaying(false);
      return;
    }
    setSeconds(getPlayStartSeconds(seconds, durationSeconds));
    setPlaying(true);
  }

  function seek(value: number) {
    setPlaying(false);
    setSeconds(value);
  }

  useEffect(() => {
    if (!playing || !canAnimate) return;
    let frame = 0;
    let previous = performance.now();
    function tick(now: number) {
      const elapsedMs = now - previous;
      previous = now;
      setSeconds((current) => getAdvancedSeconds(current, elapsedMs, durationSeconds));
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, canAnimate, durationSeconds]);

  return { seconds, complete, playing, toggle, seek };
}
