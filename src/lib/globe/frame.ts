import { TIME_RING_LOOK } from '@/lib/earthquakes/time-ring';
import { PHONE_RING_RATIO, getPhoneLayout, isPhoneViewport } from '@/lib/layout/phone';

type GlobeFrame = { cx: number; cy: number; radius: number; scale: number };

const BOARD_FRAME = { width: 1440, height: 900, cx: 720, cy: 462, radius: 330 } as const;

function getPhoneFrame(width: number, height: number): GlobeFrame {
  const { globe } = getPhoneLayout(width, height);
  return { ...globe, scale: (globe.radius * PHONE_RING_RATIO) / TIME_RING_LOOK.radius };
}

export function getGlobeFrame(width: number, height: number): GlobeFrame {
  if (isPhoneViewport(width, height)) return getPhoneFrame(width, height);
  const scale = Math.min(width / BOARD_FRAME.width, height / BOARD_FRAME.height);
  return {
    cx: (width * BOARD_FRAME.cx) / BOARD_FRAME.width,
    cy: (height * BOARD_FRAME.cy) / BOARD_FRAME.height,
    radius: BOARD_FRAME.radius * scale,
    scale,
  };
}
