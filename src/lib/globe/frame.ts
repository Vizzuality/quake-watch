type GlobeFrame = { cx: number; cy: number; radius: number; scale: number };

const BOARD_FRAME = { width: 1440, height: 800, cx: 720, cy: 384, radius: 362 } as const;

export function getGlobeFrame(width: number, height: number): GlobeFrame {
  const scale = Math.min(width / BOARD_FRAME.width, height / BOARD_FRAME.height);
  return {
    cx: (width * BOARD_FRAME.cx) / BOARD_FRAME.width,
    cy: (height * BOARD_FRAME.cy) / BOARD_FRAME.height,
    radius: BOARD_FRAME.radius * scale,
    scale,
  };
}
