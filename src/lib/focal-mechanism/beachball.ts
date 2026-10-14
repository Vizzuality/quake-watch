export type NodalPlane = { strikeDeg: number; dipDeg: number; rakeDeg: number };

export type FaultType = 'strike-slip' | 'normal' | 'reverse' | 'oblique-normal' | 'oblique-reverse';

type Vector = readonly [north: number, east: number, down: number];
type DiscPoint = readonly [x: number, y: number];
type Lune = { readonly sign: 1 | -1; readonly normal: Vector; readonly slip: Vector };
type ClippedVertex = { readonly ray: Vector; readonly isExit: boolean };

const DEG_TO_RAD = Math.PI / 180;
const ARC_STEP_RAD = 2 * DEG_TO_RAD;
const MERIDIAN_STEPS = Math.ceil(Math.PI / ARC_STEP_RAD);
const HORIZON_TOLERANCE = 1e-9;
const DEGENERATE_DEPTH = 1e-6;
const COORDINATE_DECIMALS = 2;

function getNormalizedRake(rakeDeg: number): number {
  const wrapped = ((rakeDeg % 360) + 360) % 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

export function getFaultType(plane: NodalPlane): FaultType {
  const rake = getNormalizedRake(plane.rakeDeg);
  const absRake = Math.abs(rake);
  if (absRake <= 30 || absRake >= 150) {
    return 'strike-slip';
  }
  if (absRake >= 60 && absRake <= 120) {
    return rake > 0 ? 'reverse' : 'normal';
  }
  return rake > 0 ? 'oblique-reverse' : 'oblique-normal';
}

function getDot(a: Vector, b: Vector): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function getCross(a: Vector, b: Vector): Vector {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function getScaled(a: Vector, factor: number): Vector {
  return [a[0] * factor, a[1] * factor, a[2] * factor];
}

function getSum(a: Vector, b: Vector): Vector {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function getNormalized(a: Vector): Vector {
  return getScaled(a, 1 / Math.hypot(...a));
}

function getFaultNormal({ strikeDeg, dipDeg }: NodalPlane): Vector {
  const strike = strikeDeg * DEG_TO_RAD;
  const dip = dipDeg * DEG_TO_RAD;
  return [-Math.sin(dip) * Math.sin(strike), Math.sin(dip) * Math.cos(strike), -Math.cos(dip)];
}

// Same slip vector ObsPy uses as the auxiliary-plane normal: https://github.com/obspy/obspy/blob/1.4.1/obspy/imaging/beachball.py#L750-L789
function getSlipVector({ strikeDeg, dipDeg, rakeDeg }: NodalPlane): Vector {
  const strike = strikeDeg * DEG_TO_RAD;
  const dip = dipDeg * DEG_TO_RAD;
  const rake = rakeDeg * DEG_TO_RAD;
  return [
    Math.cos(rake) * Math.cos(strike) + Math.cos(dip) * Math.sin(rake) * Math.sin(strike),
    Math.cos(rake) * Math.sin(strike) - Math.cos(dip) * Math.sin(rake) * Math.cos(strike),
    -Math.sin(rake) * Math.sin(dip),
  ];
}

function getRayFromDisc(x: number, y: number): Vector {
  const down = 1 - (x * x + y * y);
  const horizontalScale = Math.sqrt(1 + down);
  return [y * horizontalScale, x * horizontalScale, down];
}

function getDiscFromRay([north, east, down]: Vector): DiscPoint {
  const scale = Math.sqrt(1 + down);
  return [east / scale, north / scale];
}

export function getIsCompressional(plane: NodalPlane, x: number, y: number): boolean {
  const ray = getRayFromDisc(x, y);
  return getDot(ray, getFaultNormal(plane)) * getDot(ray, getSlipVector(plane)) > 0;
}

function getMeridian(nullAxis: Vector, direction: Vector): Vector[] {
  return Array.from({ length: MERIDIAN_STEPS + 1 }, (_, step) => {
    const angle = (step / MERIDIAN_STEPS) * Math.PI;
    return getSum(getScaled(nullAxis, Math.cos(angle)), getScaled(direction, Math.sin(angle)));
  });
}

function getLuneBoundary({ sign, normal, slip }: Lune): Vector[] {
  const nullAxis = getCross(normal, slip);
  const towardsNormal = getMeridian(nullAxis, getScaled(normal, sign));
  const towardsSlip = getMeridian(nullAxis, getScaled(slip, sign)).reverse();
  return [...towardsNormal, ...towardsSlip.slice(1, -1)];
}

function getIsBelowHorizon(ray: Vector): boolean {
  return ray[2] >= -HORIZON_TOLERANCE;
}

function getHorizonCrossing(from: Vector, to: Vector): Vector {
  const fraction = from[2] / (from[2] - to[2]);
  const crossing = getSum(from, getScaled(getSum(to, getScaled(from, -1)), fraction));
  return getNormalized([crossing[0], crossing[1], 0]);
}

function getLowerHemisphereClip(boundary: Vector[]): ClippedVertex[] {
  const clipped: ClippedVertex[] = [];
  boundary.forEach((current, index) => {
    const next = boundary[(index + 1) % boundary.length];
    const isCurrentBelow = getIsBelowHorizon(current);
    const isNextBelow = getIsBelowHorizon(next);
    if (isCurrentBelow !== isNextBelow) {
      clipped.push({ ray: getHorizonCrossing(current, next), isExit: isCurrentBelow });
    }
    if (isNextBelow) {
      clipped.push({ ray: next, isExit: false });
    }
  });
  return clipped;
}

function getHorizonRay(azimuth: number): Vector {
  return [Math.cos(azimuth), Math.sin(azimuth), 0];
}

function getHorizonArc(exit: Vector, entry: Vector): Vector[] {
  const exitAzimuth = Math.atan2(exit[1], exit[0]);
  const sweep =
    (((Math.atan2(entry[1], entry[0]) - exitAzimuth) % (2 * Math.PI)) + 2 * Math.PI) %
    (2 * Math.PI);
  const steps = Math.ceil(sweep / ARC_STEP_RAD);
  return Array.from({ length: Math.max(steps - 1, 0) }, (_, step) =>
    getHorizonRay(exitAzimuth + (sweep * (step + 1)) / steps),
  );
}

function getLuneRegion(lune: Lune): Vector[] {
  const clipped = getLowerHemisphereClip(getLuneBoundary(lune));
  if (clipped.every(({ ray }) => ray[2] < DEGENERATE_DEPTH)) {
    return [];
  }
  return clipped.flatMap(({ ray, isExit }, index) => {
    if (!isExit) {
      return [ray];
    }
    const entry = clipped[(index + 1) % clipped.length].ray;
    return [ray, ...getHorizonArc(ray, entry)];
  });
}

function getSvgCoordinate(value: number): string {
  return String(Number(value.toFixed(COORDINATE_DECIMALS)));
}

function getSvgPolygon(region: Vector[], radius: number): string {
  const points = region.map((ray) => {
    const [x, y] = getDiscFromRay(ray);
    return `${getSvgCoordinate(radius * (1 + x))} ${getSvgCoordinate(radius * (1 - y))}`;
  });
  return `M${points.join('L')}Z`;
}

export function getBeachballCompressionalPath(plane: NodalPlane, radius: number): string {
  const normal = getFaultNormal(plane);
  const slip = getSlipVector(plane);
  return ([1, -1] as const)
    .map((sign) => getLuneRegion({ sign, normal, slip }))
    .filter((region) => region.length > 0)
    .map((region) => getSvgPolygon(region, radius))
    .join('');
}
