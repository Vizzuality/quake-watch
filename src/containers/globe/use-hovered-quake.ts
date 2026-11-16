import { useEffect, useMemo, useRef, useState } from 'react';

import type { Earthquake } from '@/lib/earthquakes/types';

const HOVER_HIDE_DELAY_MS = 150;

export type Point = { x: number; y: number };
export type HoveredQuake = {
  earthquake: Earthquake;
  now: number;
  anchor: Point;
  containerSize: { width: number; height: number };
};

export function getQuakeKey({ source, id }: Earthquake): string {
  return `${source}:${id}`;
}

export function useHoveredQuake() {
  const [hovered, setHovered] = useState<HoveredQuake | null>(null);
  const [isOverQuake, setIsOverQuake] = useState(false);
  const keyRef = useRef<string | null>(null);
  const isOverQuakeRef = useRef(false);
  const isOverTooltipRef = useRef(false);
  const hideTimerRef = useRef<number | undefined>(undefined);

  const actions = useMemo(() => {
    function updateOverQuake(next: boolean) {
      if (isOverQuakeRef.current === next) return;
      isOverQuakeRef.current = next;
      setIsOverQuake(next);
    }

    function cancelHide() {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = undefined;
    }

    function hide() {
      cancelHide();
      updateOverQuake(false);
      isOverTooltipRef.current = false;
      if (keyRef.current === null) return;
      keyRef.current = null;
      setHovered(null);
    }

    function show(next: HoveredQuake) {
      cancelHide();
      updateOverQuake(true);
      const key = getQuakeKey(next.earthquake);
      if (keyRef.current === key) return;
      keyRef.current = key;
      setHovered(next);
    }

    function scheduleHide() {
      updateOverQuake(false);
      if (keyRef.current === null || isOverTooltipRef.current) return;
      if (hideTimerRef.current !== undefined) return;
      hideTimerRef.current = window.setTimeout(hide, HOVER_HIDE_DELAY_MS);
    }

    function enterTooltip() {
      isOverTooltipRef.current = true;
      cancelHide();
    }

    function leaveTooltip() {
      isOverTooltipRef.current = false;
      scheduleHide();
    }

    return { show, scheduleHide, hide, enterTooltip, leaveTooltip };
  }, []);

  useEffect(() => () => window.clearTimeout(hideTimerRef.current), []);

  return { hovered, isOverQuake, ...actions };
}
