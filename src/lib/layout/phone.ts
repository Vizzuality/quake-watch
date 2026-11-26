export const PHONE_MAX_WIDTH = 768;
export const PHONE_MAX_HEIGHT = 480;
export const PHONE_QUERY = `(width < ${PHONE_MAX_WIDTH}px), (height < ${PHONE_MAX_HEIGHT}px)`;
export const PHONE_HEADER_BOTTOM = 90;
export const SIDE_SHEET_WIDTH = 320;
const SIDE_HEADER_BOTTOM = 52;
const SIDE_RING_SIDE_PX = 56;
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
  isSide: boolean;
  mapWidth: number;
  headerBottom: number;
  homeMapBottom: number;
  detailMapBottom: number;
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

export function isPhoneViewport(width: number, height: number): boolean {
  return width < PHONE_MAX_WIDTH || height < PHONE_MAX_HEIGHT;
}

export function isSideViewport(width: number, height: number): boolean {
  return height < PHONE_MAX_HEIGHT && width >= height;
}

function getSideGlobe(mapWidth: number, height: number): PhoneGlobe {
  const cy = (SIDE_HEADER_BOTTOM + height) / 2;
  const radius = Math.min(
    (cy - SIDE_HEADER_BOTTOM - RING_LABEL_PX) / PHONE_RING_RATIO,
    (mapWidth / 2 - SIDE_RING_SIDE_PX) / PHONE_RING_RATIO,
  );
  return { cx: mapWidth / 2, cy, radius };
}

function getSideLayout(width: number, height: number): PhoneLayout {
  const mapWidth = width - SIDE_SHEET_WIDTH;
  return {
    k: Math.min(1, mapWidth / BOARD.width),
    isSide: true,
    mapWidth,
    headerBottom: SIDE_HEADER_BOTTOM,
    homeMapBottom: height,
    detailMapBottom: height,
    homeSheetTop: 0,
    homeSheetOpenTop: 0,
    detailSheetTop: 0,
    detailSheetOpenTop: 0,
    detailFocusY: (PHONE_ACTION_ROW_BOTTOM + height) / 2,
    globe: getSideGlobe(mapWidth, height),
  };
}

function getHomeSheetOpenTop(height: number, headerBottom: number): number {
  const boardGap = SHEET.home.openTop - PHONE_HEADER_BOTTOM;
  return Math.max(getBoardY(SHEET.home.openTop, height), headerBottom + boardGap);
}

export function getPhoneLayout(width: number, height: number): PhoneLayout {
  if (isSideViewport(width, height)) return getSideLayout(width, height);
  const k = Math.min(width / BOARD.width, height / BOARD.height);
  const headerBottom = PHONE_HEADER_BOTTOM;
  const homeSheetTop = Math.min(getBoardY(SHEET.home.top, height), height - SHEET.home.minHeight);
  const detailSheetTop = Math.min(
    getBoardY(SHEET.detail.top, height),
    height - SHEET.detail.minHeight,
  );
  return {
    k,
    isSide: false,
    mapWidth: width,
    headerBottom,
    homeMapBottom: homeSheetTop,
    detailMapBottom: detailSheetTop,
    homeSheetTop,
    homeSheetOpenTop: getHomeSheetOpenTop(height, headerBottom),
    detailSheetTop,
    detailSheetOpenTop: getBoardY(SHEET.detail.openTop, height),
    detailFocusY: getBoardY(DETAIL_FOCUS_Y, height),
    globe: getPhoneGlobe(width, height, k, headerBottom, homeSheetTop),
  };
}
