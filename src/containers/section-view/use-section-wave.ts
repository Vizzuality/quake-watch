import { type RefObject, useEffect } from 'react';

import { useIsWavePaused } from '@/containers/globe/wave-pause';
import { subscribeWaveReplay } from '@/containers/globe/wave-replay';
import { SECTION_WAVE, getWaveRing } from '@/lib/section/section-wave';

import { PULSE_RINGS } from './section-figure';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function useSectionWave(ringsRef: RefObject<SVGGElement | null>, earthquakeId: string) {
  const isPaused = useIsWavePaused();

  useEffect(() => {
    const circles = Array.from(ringsRef.current?.querySelectorAll('circle') ?? []);
    let frame = 0;
    let startedAt = performance.now();

    function drawStill() {
      circles.forEach((circle, index) => {
        circle.setAttribute('r', String(PULSE_RINGS[index].radius));
        circle.setAttribute('stroke-opacity', String(PULSE_RINGS[index].opacity));
      });
    }

    function draw(now: number) {
      if (isPaused && now - startedAt >= SECTION_WAVE.periodMs) {
        drawStill();
        return;
      }
      circles.forEach((circle, index) => {
        const { radius, opacity } = getWaveRing(now - startedAt, index, circles.length);
        circle.setAttribute('r', radius.toFixed(1));
        circle.setAttribute('stroke-opacity', opacity.toFixed(3));
      });
      frame = requestAnimationFrame(draw);
    }

    function replay(id: string) {
      if (id !== earthquakeId) return;
      startedAt = performance.now();
      if (!isPaused || window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    }

    if (isPaused) drawStill();
    else frame = requestAnimationFrame(draw);
    const unsubscribe = subscribeWaveReplay(replay);
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [ringsRef, earthquakeId, isPaused]);
}
