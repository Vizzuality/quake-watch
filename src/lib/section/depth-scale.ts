export type DepthTick = { depthKm: number; y: number };

export type DepthScale = {
  getY: (depthKm: number) => number;
  bottomY: number;
  bottomDepthKm: number;
  ticks: DepthTick[];
  stretch: { top: number; below: number };
};

const LEFT = 585;
const RIGHT = 1315;
const SLICE_KM = 900;
const PX_PER_KM = (RIGHT - LEFT) / SLICE_KM;

export const SECTION_FRAME = {
  left: LEFT,
  right: RIGHT,
  centre: (LEFT + RIGHT) / 2,
  sliceKm: SLICE_KM,
  seaLevelY: 330,
  getX: (alongKm: number) => (LEFT + RIGHT) / 2 + alongKm * PX_PER_KM,
};

const TOP_KM = 10;
const TOP_PX_PER_KM = 7.5;
const BELOW_PX_PER_KM = 0.95;
const DESIGN_BOTTOM_KM = 300;
const TICK_STEP_KM = 100;
const MIN_TICK_GAP_PX = 30;
const TOP_Y = SECTION_FRAME.seaLevelY + TOP_KM * TOP_PX_PER_KM;
const BOTTOM_Y = TOP_Y + (DESIGN_BOTTOM_KM - TOP_KM) * BELOW_PX_PER_KM;

function getBottomDepthKm(maxDepthKm: number): number {
  return Math.max(DESIGN_BOTTOM_KM, Math.ceil(maxDepthKm / TICK_STEP_KM) * TICK_STEP_KM);
}

function getTickStepKm(belowPxPerKm: number): number {
  return belowPxPerKm * TICK_STEP_KM >= MIN_TICK_GAP_PX ? TICK_STEP_KM : TICK_STEP_KM * 2;
}

export function getDepthScale(maxDepthKm: number): DepthScale {
  const bottomDepthKm = getBottomDepthKm(maxDepthKm);
  const belowPxPerKm = Math.min(BELOW_PX_PER_KM, (BOTTOM_Y - TOP_Y) / (bottomDepthKm - TOP_KM));

  function getY(depthKm: number): number {
    if (depthKm <= TOP_KM) return SECTION_FRAME.seaLevelY + depthKm * TOP_PX_PER_KM;
    return TOP_Y + (depthKm - TOP_KM) * belowPxPerKm;
  }

  const stepKm = getTickStepKm(belowPxPerKm);
  const deepTicks = Array.from(
    { length: Math.floor(bottomDepthKm / stepKm) },
    (_, index) => (index + 1) * stepKm,
  );

  return {
    getY,
    bottomY: getY(bottomDepthKm),
    bottomDepthKm,
    ticks: [0, TOP_KM, ...deepTicks].map((depthKm) => ({ depthKm, y: getY(depthKm) })),
    stretch: {
      top: Math.round(TOP_PX_PER_KM / PX_PER_KM),
      below: Math.round((belowPxPerKm / PX_PER_KM) * 10) / 10,
    },
  };
}
