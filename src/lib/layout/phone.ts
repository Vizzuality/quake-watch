export const PHONE_MAX_WIDTH = 768;
export const PHONE_QUERY = `(width < ${PHONE_MAX_WIDTH}px)`;
export const PHONE_HEADER_BOTTOM = 90;
export const PHONE_ACTION_ROW_BOTTOM = 128;

const BOARD = { width: 390, height: 844 } as const;
const DETAIL_FOCUS_Y = 290;
const GLOBE = { cy: 330, radius: 122 } as const;
const SHEET = {
  home: { top: 548, openTop: 128, minHeight: 296 },
  detail: { top: 566, openTop: 150, minHeight: 278 },
} as const;
export const PHONE_RING_RATIO = 144 / 122;
const RING_LABEL_PX = 30;

type PhoneGlobe = { cx: number; cy: number; radius: number };

export type PhoneLayout = {
  k: number;
  headerBottom: number;
  homeSheetTop: number;
  homeSheetOpenTop: number;
  detailSheetTop: number;
  detailSheetOpenTop: number;
  detailFocusY: number;
  globe: PhoneGlobe;
};

function getBoardY(y: number, height: number): number {
  return (height * y) / BOARD.height;
}

function getPhoneGlobe(
  width: number,
  height: number,
  k: number,
  headerBottom: number,
  sheetTop: number,
): PhoneGlobe {
  const halfSpace = (sheetTop - headerBottom) / 2;
  const radius = Math.min(GLOBE.radius * k, (halfSpace - RING_LABEL_PX) / PHONE_RING_RATIO);
  const extent = radius * PHONE_RING_RATIO + RING_LABEL_PX;
  const cy = Math.min(
    Math.max(getBoardY(GLOBE.cy, height), headerBottom + extent),
    sheetTop - extent,
  );
  return { cx: width / 2, cy, radius };
}

export function getPhoneLayout(width: number, height: number): PhoneLayout {
  const k = Math.min(width / BOARD.width, height / BOARD.height);
  const headerBottom = PHONE_HEADER_BOTTOM;
  const homeSheetTop = Math.min(getBoardY(SHEET.home.top, height), height - SHEET.home.minHeight);
  return {
    k,
    headerBottom,
    homeSheetTop,
    homeSheetOpenTop: getBoardY(SHEET.home.openTop, height),
    detailSheetTop: Math.min(getBoardY(SHEET.detail.top, height), height - SHEET.detail.minHeight),
    detailSheetOpenTop: getBoardY(SHEET.detail.openTop, height),
    detailFocusY: getBoardY(DETAIL_FOCUS_Y, height),
    globe: getPhoneGlobe(width, height, k, headerBottom, homeSheetTop),
  };
}
