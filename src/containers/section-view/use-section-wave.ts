import { type RefObject, useEffect } from 'react';

import { subscribeWaveReplay } from '@/containers/globe/wave-replay';
import { getWaveRing } from '@/lib/section/section-wave';

import { PULSE_RINGS } from './section-figure';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function useSectionWave(ringsRef: RefObject<SVGGElement | null>, earthquakeId: string) {
  useEffect(() => {
    const circles = Array.from(ringsRef.current?.querySelectorAll('circle') ?? []);
    const motion = window.matchMedia(REDUCED_MOTION_QUERY);
    let frame = 0;
    let startedAt = performance.now();

    function draw(now: number) {
      circles.forEach((circle, index) => {
        const { radius, opacity } = getWaveRing(now - startedAt, index, circles.length);
        circle.setAttribute('r', radius.toFixed(1));
        circle.setAttribute('stroke-opacity', opacity.toFixed(3));
      });
      frame = requestAnimationFrame(draw);
    }

    function drawStill() {
      circles.forEach((circle, index) => {
        circle.setAttribute('r', String(PULSE_RINGS[index].radius));
        circle.setAttribute('stroke-opacity', String(PULSE_RINGS[index].opacity));
      });
    }

    function start() {
      cancelAnimationFrame(frame);
      if (motion.matches) {
        drawStill();
        return;
      }
      frame = requestAnimationFrame(draw);
    }

    function replay(id: string) {
      if (id === earthquakeId) startedAt = performance.now();
    }

    start();
    motion.addEventListener('change', start);
    const unsubscribe = subscribeWaveReplay(replay);
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener('change', start);
      unsubscribe();
    };
  }, [ringsRef, earthquakeId]);
}
