import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { createRef, useImperativeHandle, useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import Globe from '@/containers/globe/globe';
import {
  type GlobeControls,
  MAX_RELEASE_SPEED,
  useGlobeControls,
} from '@/containers/globe/use-globe-controls';
import { getFeltReachKm } from '@/lib/earthquakes/intensity';
import { EARTHQUAKE_SEARCH_ROUTE, type MinMagnitude } from '@/lib/earthquakes/search-schema';
import {
  FELT_RING_LOOK,
  getFeltRingAngle,
  getMinRingRadiusPx,
  getWaveFronts,
  getWaveLifeSeconds,
} from '@/lib/globe/felt-rings';
import { getGlobeFrame } from '@/lib/globe/frame';
import { INITIAL_VIEW, ZOOM_RANGE } from '@/lib/globe/motion';
import { QUAKE_MARKER_LOOK, getEpicentreRadiusPx, getHypocentreRadius } from '@/lib/globe/quakes';
import { getLatLonVector, getRotatedVector } from '@/lib/globe/sphere';
import { overwriteGetLocale } from '@/paraglide/runtime';
import { getEmscFeature, getFeatureCollection } from '@/test/fixtures/earthquakes';
import { stubFetch } from '@/test/stub-fetch';

type Point = { x: number; y: number };
type Snapshot = { data: Uint8Array; width: number; height: number; dpr: number };
type TestQuake = { lat: number; lon: number; depth: number; mag: number };

const WIDTH = 1280;
const HEIGHT = 800;
const { cx: CX, cy: CY, radius: RADIUS } = getGlobeFrame(WIDTH, HEIGHT);
const CENTRE: Point = { x: CX, y: CY };
const FRAME = 1 / 60;
const LIST_PATH = '/fdsnws/event/1/query';
const PAINT_THRESHOLD = 8;
const DEEPEST_RGB = [0x4f, 0x7b, 0xff];
const VIEW_LAT = (INITIAL_VIEW.lat * 180) / Math.PI;
const VIEW_LON = (INITIAL_VIEW.lon * 180) / Math.PI;

const DEEP_QUAKE: TestQuake = { lat: VIEW_LAT, lon: -173, depth: 600, mag: 6 };
const SHALLOW_QUAKE: TestQuake = { lat: -30, lon: 175, depth: 10, mag: 6 };
const STRONG_QUAKE: TestQuake = { lat: 25, lon: VIEW_LON + 20, depth: 300, mag: 6 };
const LIGHT_QUAKE: TestQuake = { lat: 25, lon: VIEW_LON - 20, depth: 300, mag: 3 };
const DEEPEST_QUAKE: TestQuake = { lat: 25, lon: -175, depth: 700, mag: 6 };
const FAR_SIDE_QUAKE: TestQuake = { lat: -VIEW_LAT, lon: VIEW_LON - 180, depth: 300, mag: 6 };
const PAST_LIMB_QUAKE: TestQuake = {
  lat: VIEW_LAT,
  lon: VIEW_LON + 101.5 - 360,
  depth: 300,
  mag: 6,
};
const NORTH_QUAKE: TestQuake = { lat: 20, lon: 175, depth: 300, mag: 5 };
const SOUTH_QUAKE: TestQuake = { lat: -20, lon: -170, depth: 300, mag: 5 };
const FELT_M5: TestQuake = { lat: VIEW_LAT, lon: VIEW_LON, depth: 10, mag: 5 };
const HOLLOW_M4: TestQuake = { lat: VIEW_LAT, lon: VIEW_LON + 15, depth: 500, mag: 4 };
const CENTRE_M3: TestQuake = { lat: VIEW_LAT, lon: VIEW_LON, depth: 10, mag: 3 };
const LIMB_M3: TestQuake = { lat: VIEW_LAT, lon: VIEW_LON + 72.5 - 360, depth: 10, mag: 3 };
const WAVE_M7: TestQuake = { lat: VIEW_LAT, lon: VIEW_LON, depth: 10, mag: 7 };
const ANTIPODE_M8: TestQuake = { lat: -VIEW_LAT, lon: VIEW_LON - 180, depth: 10, mag: 8 };
const LIMB_M7: TestQuake = { lat: VIEW_LAT, lon: VIEW_LON + 80 - 360, depth: 10, mag: 7 };
const realMatchMedia = window.matchMedia.bind(window);

function waitFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let left = count;
    const tick = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) =>
    Object.defineProperty(realMatchMedia(query), 'matches', { value: matches }),
  );
}

function freezeClock() {
  let now = performance.now();
  const spy = vi.spyOn(performance, 'now').mockImplementation(() => now);
  return {
    advance: (ms: number) => {
      now += ms;
    },
    restore: () => spy.mockRestore(),
  };
}

function stubWebGL(availableCalls: number) {
  const original = HTMLCanvasElement.prototype.getContext;
  let calls = 0;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
    ...args: Parameters<HTMLCanvasElement['getContext']>
  ) {
    calls += 1;
    return calls <= availableCalls ? original.apply(this, args) : null;
  } as HTMLCanvasElement['getContext']);
}

function stubPreservedDrawingBuffer() {
  const original = HTMLCanvasElement.prototype.getContext;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
    type: string,
    attributes?: WebGLContextAttributes,
  ) {
    return original.call(this, type, { ...attributes, preserveDrawingBuffer: true });
  } as HTMLCanvasElement['getContext']);
}

function getPixelAlpha(canvas: HTMLCanvasElement, x: number, y: number): number {
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('globe canvas has no WebGL2 context');
  const dpr = gl.drawingBufferWidth / canvas.clientWidth;
  const pixel = new Uint8Array(4);
  gl.readPixels(
    Math.floor(x * dpr),
    Math.floor(gl.drawingBufferHeight - y * dpr),
    1,
    1,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    pixel,
  );
  return pixel[3];
}

function getPaintedPixelCount(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  size: number,
): number {
  let count = 0;
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      if (getPixelAlpha(canvas, x + dx, y + dy) > 0) count++;
    }
  }
  return count;
}

function getSnapshot(canvas: HTMLCanvasElement): Snapshot {
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('globe canvas has no WebGL2 context');
  const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
  const data = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
  return { data, width, height, dpr: width / canvas.clientWidth };
}

function getRgb(snapshot: Snapshot, { x, y }: Point): number[] {
  const column = Math.floor(x * snapshot.dpr);
  const row = snapshot.height - 1 - Math.floor(y * snapshot.dpr);
  const index = (row * snapshot.width + column) * 4;
  return [...snapshot.data.subarray(index, index + 3)];
}

function getRgbDiff(before: Snapshot, after: Snapshot, point: Point): number[] {
  const base = getRgb(before, point);
  return getRgb(after, point).map((channel, index) => channel - base[index]);
}

function getPaintedDiffCount(before: Snapshot, after: Snapshot, centre: Point, size: number) {
  const left = Math.floor(centre.x - size / 2);
  const top = Math.floor(centre.y - size / 2);
  let count = 0;
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const diff = getRgbDiff(before, after, { x: left + dx + 0.5, y: top + dy + 0.5 });
      if (diff.some((channel) => channel > PAINT_THRESHOLD)) count++;
    }
  }
  return count;
}

function getDiffLevel(before: Snapshot, after: Snapshot, point: Point): number {
  return Math.max(...getRgbDiff(before, after, point));
}

function getChangedPixelCount(before: Snapshot, after: Snapshot): number {
  let count = 0;
  for (let index = 0; index < before.data.length; index += 4) {
    const pixel = before.data.subarray(index, index + 4);
    if (pixel.some((channel, offset) => channel !== after.data[index + offset])) count++;
  }
  return count;
}

function getRayPoints(from: Point, min: number, max: number): { distance: number; point: Point }[] {
  const points = [];
  for (let distance = Math.floor(min) + 0.5; distance <= max; distance += 1) {
    points.push({ distance, point: { x: from.x + distance, y: from.y } });
  }
  return points;
}

function getPeakDistance(
  before: Snapshot,
  after: Snapshot,
  from: Point,
  [min, max]: readonly [number, number],
): number {
  return getRayPoints(from, min, max).reduce(
    (best, ray) => {
      const level = getDiffLevel(before, after, ray.point);
      return level > best.level ? { distance: ray.distance, level } : best;
    },
    { distance: Number.NaN, level: -Infinity },
  ).distance;
}

function getOutermostPaintedDistance(before: Snapshot, after: Snapshot, from: Point, max: number) {
  return getRayPoints(from, 0, max)
    .filter(({ point }) => getDiffLevel(before, after, point) > PAINT_THRESHOLD)
    .reduce((outermost, { distance }) => Math.max(outermost, distance), 0);
}

function getPixelsAround(
  centre: Point,
  isIncluded: (pixel: Point, distance: number) => boolean,
): Point[] {
  const pixels: Point[] = [];
  for (let dy = -12; dy <= 12; dy++) {
    for (let dx = -12; dx <= 12; dx++) {
      const pixel = { x: Math.floor(centre.x) + dx + 0.5, y: Math.floor(centre.y) + dy + 0.5 };
      if (isIncluded(pixel, getDistance(pixel, centre))) pixels.push(pixel);
    }
  }
  return pixels;
}

function getPixelGrid(topLeft: Point, bottomRight: Point): Point[] {
  const pixels: Point[] = [];
  for (let y = Math.floor(topLeft.y) + 0.5; y <= bottomRight.y; y += 2) {
    for (let x = Math.floor(topLeft.x) + 0.5; x <= bottomRight.x; x += 2) pixels.push({ x, y });
  }
  return pixels;
}

function getRotatedZ({ lat, lon }: TestQuake): number {
  return getRotatedVector(getLatLonVector(lat, lon), INITIAL_VIEW.lon, INITIAL_VIEW.lat)[2];
}

function getScreenPoint(lat: number, lon: number, radius: number): Point {
  const [x, y] = getRotatedVector(getLatLonVector(lat, lon), INITIAL_VIEW.lon, INITIAL_VIEW.lat);
  return { x: CX + x * radius * RADIUS, y: CY - y * radius * RADIUS };
}

function getQuakePoints({ lat, lon, depth }: TestQuake) {
  return {
    epicentre: getScreenPoint(lat, lon, 1),
    hypocentre: getScreenPoint(lat, lon, getHypocentreRadius(depth)),
  };
}

function getDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getPointToward(from: Point, to: Point, distance: number): Point {
  const k = distance / getDistance(from, to);
  return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
}

function getSegmentDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
  const clamped = Math.min(1, Math.max(0, t));
  return getDistance(point, { x: start.x + dx * clamped, y: start.y + dy * clamped });
}

function getOffNeedlePixel(epicentre: Point, hypocentre: Point): Point {
  const pixels = [-2, -1, 0, 1, 2].flatMap((dy) =>
    [-2, -1, 0, 1, 2].map((dx) => ({
      x: Math.floor(hypocentre.x) + dx + 0.5,
      y: Math.floor(hypocentre.y) + dy + 0.5,
    })),
  );
  const inside = pixels.filter((pixel) => getDistance(pixel, hypocentre) <= 1.6);
  return inside.reduce((best, pixel) =>
    getSegmentDistance(pixel, epicentre, hypocentre) >
    getSegmentDistance(best, epicentre, hypocentre)
      ? pixel
      : best,
  );
}

function getQuakeResponse(quakes: readonly TestQuake[]): Response {
  const features = quakes.map(({ lat, lon, depth, mag }, index) =>
    getEmscFeature({ id: `test_${index}`, lat, lon, depth, mag }),
  );
  return Response.json(getFeatureCollection(features));
}

function isListRequest(url: URL): boolean {
  return url.pathname === LIST_PATH;
}

async function renderGlobe(quakesByMinMagnitude: Partial<Record<MinMagnitude, TestQuake[]>> = {}) {
  const fetchMock = stubFetch([
    ...Object.entries(quakesByMinMagnitude).map(([minmag, quakes]) => ({
      match: (url: URL) => isListRequest(url) && url.searchParams.get('minmagnitude') === minmag,
      respond: () => getQuakeResponse(quakes),
    })),
    { match: isListRequest, respond: () => getQuakeResponse([]) },
  ]);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute({ component: Outlet });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    ...EARTHQUAKE_SEARCH_ROUTE,
    component: () => (
      <div style={{ position: 'relative', width: WIDTH, height: HEIGHT }}>
        <Globe />
      </div>
    ),
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  await router.load();
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  function getCanvas(): HTMLCanvasElement {
    const canvas = screen.container.querySelector('canvas');
    if (!canvas) throw new Error('globe canvas is not mounted');
    return canvas;
  }

  async function getSettledSnapshot(): Promise<Snapshot> {
    await expect.poll(() => fetchMock.mock.calls.length).toBeGreaterThan(0);
    await expect.poll(() => queryClient.isFetching()).toBe(0);
    await vi.waitFor(getCanvas);
    await waitFrames(10);
    return getSnapshot(getCanvas());
  }

  async function showMinMagnitude(minmag: MinMagnitude): Promise<Snapshot> {
    const calls = fetchMock.mock.calls.length;
    await router.navigate({ to: '/', search: { minmag } });
    await expect.poll(() => fetchMock.mock.calls.length).toBeGreaterThan(calls);
    return getSettledSnapshot();
  }

  return { screen, getCanvas, getSettledSnapshot, showMinMagnitude };
}

async function renderQuakes(quakes: TestQuake[]) {
  stubReducedMotion(true);
  stubPreservedDrawingBuffer();
  const globe = await renderGlobe({ 3: quakes });
  const before = await globe.getSettledSnapshot();
  const after = await globe.showMinMagnitude(3);
  return {
    getPaintedCount: (centre: Point, size: number) =>
      getPaintedDiffCount(before, after, centre, size),
    getBeforeRgb: (point: Point) => getRgb(before, point),
    getDiff: (point: Point) => getRgbDiff(before, after, point),
  };
}

async function renderRings(quakes: TestQuake[], { zoom = 1 } = {}) {
  stubReducedMotion(true);
  stubPreservedDrawingBuffer();
  const globe = await renderGlobe({ 3: quakes });
  const container = globe.screen.getByRole('img').element();
  if (zoom > 1) {
    for (let i = 0; i < 20; i++) {
      container.dispatchEvent(
        new WheelEvent('wheel', { deltaY: -200, bubbles: true, cancelable: true }),
      );
    }
  }
  const empty = await globe.getSettledSnapshot();
  const rest = await globe.showMinMagnitude(3);
  const snapshot = () => getSnapshot(globe.getCanvas());
  return { empty, rest, snapshot };
}

function playWaves() {
  const play = window.__playGlobeWaves;
  expect(play).toBeTypeOf('function');
  play?.();
}

async function renderControls() {
  const controlsRef = createRef<GlobeControls>();

  function Probe() {
    const targetRef = useRef<HTMLDivElement>(null);
    const controls = useGlobeControls(targetRef);
    useImperativeHandle(controlsRef, () => controls, [controls]);
    return <div ref={targetRef} data-testid="target" style={{ width: WIDTH, height: HEIGHT }} />;
  }

  const screen = await render(<Probe />);
  const target = screen.getByTestId('target').element() as HTMLElement;
  vi.spyOn(target, 'setPointerCapture').mockImplementation(() => {});
  if (!controlsRef.current) throw new Error('controls probe did not mount');
  const controls = controlsRef.current;

  function pointer(type: string, x: number, { y = 100, id = 1, time = 0 } = {}) {
    const event = new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true });
    Object.defineProperty(event, 'timeStamp', { value: time });
    target.dispatchEvent(event);
  }

  function wheel(deltaY: number) {
    const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  }

  function step(frames: number) {
    for (let i = 0; i < frames; i++) controls.advance(FRAME, i * FRAME * 1000);
    return controls.viewRef.current;
  }

  function flick({ sampleMs = 16, pauseMs = 0 } = {}) {
    pointer('pointerdown', 100);
    for (let i = 1; i <= 5; i++) pointer('pointermove', 100 + i * 20, { time: i * sampleMs });
    pointer('pointerup', 200, { time: 5 * sampleMs + pauseMs });
  }

  return { controls, pointer, wheel, step, flick };
}

describe('globe', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    overwriteGetLocale(() => 'en');
  });

  it('draws a labelled WebGL canvas without errors', async () => {
    const consoleError = vi.spyOn(console, 'error');
    const { screen } = await renderGlobe();

    await expect
      .element(
        screen.getByRole('img', { name: 'Globe of Earthquakes. Drag to rotate, scroll to zoom.' }),
      )
      .toBeVisible();
    await vi.waitFor(() => expect(screen.container.querySelector('canvas')).not.toBeNull());
    await waitFrames(10);
    expect(screen.container.querySelector('output')).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('leaves the canvas transparent around the globe and paints dots on it', async () => {
    stubPreservedDrawingBuffer();
    const { screen } = await renderGlobe();

    await vi.waitFor(() => expect(screen.container.querySelector('canvas')).not.toBeNull());
    await waitFrames(10);
    const canvas = screen.container.querySelector('canvas') as HTMLCanvasElement;
    expect(getPixelAlpha(canvas, 1, 1)).toBe(0);
    expect(getPaintedPixelCount(canvas, CX + RADIUS * 1.05, CY, 16)).toBe(0);
    expect(getPaintedPixelCount(canvas, CX - 8, CY - 8, 16)).toBeGreaterThan(0);
  });

  it('draws a 600 km Earthquake inside the sphere and a 10 km one at the surface', async () => {
    const { getPaintedCount, getDiff } = await renderQuakes([DEEP_QUAKE, SHALLOW_QUAKE]);

    const deep = getQuakePoints(DEEP_QUAKE);
    expect(getDistance(deep.hypocentre, CENTRE)).toBeCloseTo(
      getDistance(deep.epicentre, CENTRE) * 0.34076,
      3,
    );
    expect(getPaintedCount(deep.hypocentre, 6)).toBeGreaterThanOrEqual(9);
    expect(getPaintedCount(getPointToward(deep.hypocentre, CENTRE, 6), 3)).toBe(0);

    const shallow = getQuakePoints(SHALLOW_QUAKE);
    expect(getDistance(shallow.hypocentre, shallow.epicentre)).toBeLessThan(4);
    expect(getPaintedCount(shallow.hypocentre, 6)).toBeGreaterThanOrEqual(9);
    const feltFill = Math.ceil(255 * FELT_RING_LOOK.fillA) + 2;
    for (const distance of [7, 10, 14]) {
      for (const channel of getDiff(getPointToward(shallow.epicentre, CENTRE, distance))) {
        expect(channel).toBeLessThanOrEqual(feltFill);
      }
    }
    for (const distance of [30, 40]) {
      expect(getPaintedCount(getPointToward(shallow.epicentre, CENTRE, distance), 3)).toBe(0);
    }
  });

  it('paints an M6 hypocentre larger than an M3 one at the same Depth', async () => {
    const { getPaintedCount } = await renderQuakes([STRONG_QUAKE, LIGHT_QUAKE]);

    const strong = getQuakePoints(STRONG_QUAKE).hypocentre;
    const light = getQuakePoints(LIGHT_QUAKE).hypocentre;
    expect(strong.y).toBeCloseTo(light.y, 6);
    expect(strong.x - CX).toBeCloseTo(CX - light.x, 6);
    const lightCount = getPaintedCount(light, 9);
    expect(lightCount).toBeGreaterThan(0);
    expect(getPaintedCount(strong, 9)).toBeGreaterThan(lightCount + 5);
  });

  it('colours the hypocentre and the needle by Depth', async () => {
    const { getPaintedCount, getBeforeRgb, getDiff } = await renderQuakes([DEEPEST_QUAKE]);

    const { epicentre, hypocentre } = getQuakePoints(DEEPEST_QUAKE);
    const pixel = getOffNeedlePixel(epicentre, hypocentre);
    expect(getSegmentDistance(pixel, epicentre, hypocentre)).toBeGreaterThanOrEqual(1);
    for (const channel of getBeforeRgb(pixel)) expect(channel).toBeLessThan(60);
    getDiff(pixel).forEach((channel, index) =>
      expect(
        Math.abs(channel / QUAKE_MARKER_LOOK.hypocentreA - DEEPEST_RGB[index]),
      ).toBeLessThanOrEqual(40),
    );
    const midpoint = { x: (epicentre.x + hypocentre.x) / 2, y: (epicentre.y + hypocentre.y) / 2 };
    expect(getPaintedCount(midpoint, 3)).toBeGreaterThanOrEqual(1);
  });

  it('hides Earthquakes on the far side of the globe', async () => {
    const { getPaintedCount } = await renderQuakes([FAR_SIDE_QUAKE, PAST_LIMB_QUAKE, DEEP_QUAKE]);

    expect(getPaintedCount(getQuakePoints(DEEP_QUAKE).hypocentre, 6)).toBeGreaterThan(0);
    const [, , pastLimbZ] = getRotatedVector(
      getLatLonVector(PAST_LIMB_QUAKE.lat, PAST_LIMB_QUAKE.lon),
      INITIAL_VIEW.lon,
      INITIAL_VIEW.lat,
    );
    expect(pastLimbZ).toBeCloseTo(-0.2, 1);
    for (const quake of [FAR_SIDE_QUAKE, PAST_LIMB_QUAKE]) {
      const { epicentre, hypocentre } = getQuakePoints(quake);
      expect(getPaintedCount(epicentre, 16)).toBe(0);
      expect(getPaintedCount(hypocentre, 16)).toBe(0);
    }
  });

  it('redraws the Earthquakes on a filter change without remounting the canvas', async () => {
    stubReducedMotion(true);
    stubPreservedDrawingBuffer();
    const globe = await renderGlobe({ 3: [NORTH_QUAKE], 5: [SOUTH_QUAKE] });
    const empty = await globe.getSettledSnapshot();
    const canvas = globe.getCanvas();

    const north = await globe.showMinMagnitude(3);
    expect(globe.getCanvas()).toBe(canvas);
    const south = await globe.showMinMagnitude(5);
    expect(globe.getCanvas()).toBe(canvas);

    const northPoint = getQuakePoints(NORTH_QUAKE).hypocentre;
    const southPoint = getQuakePoints(SOUTH_QUAKE).hypocentre;
    expect(getPaintedDiffCount(empty, north, northPoint, 6)).toBeGreaterThan(0);
    expect(getPaintedDiffCount(empty, north, southPoint, 6)).toBe(0);
    expect(getPaintedDiffCount(empty, south, southPoint, 6)).toBeGreaterThan(0);
    expect(getPaintedDiffCount(empty, south, northPoint, 6)).toBe(0);
  });

  it('fills a shallow M5 ring out to its Felt reach', async () => {
    const { empty, rest } = await renderRings([FELT_M5], { zoom: ZOOM_RANGE[1] });

    const expected = RADIUS * ZOOM_RANGE[1] * Math.sin(getFeltRingAngle(5, 10));
    expect(getFeltReachKm({ magnitude: 5, depthKm: 10 })).toBeGreaterThan(180);
    expect(expected).toBeCloseTo(42.8, 0);
    const edge = getPeakDistance(empty, rest, CENTRE, [expected * 0.8, expected * 1.2]);
    expect(Math.abs(edge - expected)).toBeLessThanOrEqual(expected * 0.05);
    const fill = getDiffLevel(empty, rest, { x: CX + expected / 2, y: CY });
    expect(fill).toBeGreaterThan(PAINT_THRESHOLD);
    expect(getDiffLevel(empty, rest, { x: CX + edge, y: CY })).toBeGreaterThan(fill * 2);
    expect(getDiffLevel(empty, rest, { x: CX + expected + 3, y: CY })).toBeLessThanOrEqual(
      PAINT_THRESHOLD,
    );
  });

  it('draws a hollow ring around a 500 km M4 nobody feels', async () => {
    const { empty, rest } = await renderRings([HOLLOW_M4]);

    expect(getFeltRingAngle(4, 500)).toBe(0);
    const { epicentre, hypocentre } = getQuakePoints(HOLLOW_M4);
    const minPx = getMinRingRadiusPx(4);
    const isOffNeedle = (pixel: Point) => getSegmentDistance(pixel, epicentre, hypocentre) > 2;
    const gap = getPixelsAround(
      epicentre,
      (pixel, distance) =>
        distance >= getEpicentreRadiusPx(4) + 0.5 && distance <= minPx - 1 && isOffNeedle(pixel),
    );
    expect(gap.length).toBeGreaterThanOrEqual(8);
    expect(gap.filter((pixel) => getDiffLevel(empty, rest, pixel) > PAINT_THRESHOLD)).toEqual([]);
    const stroke = getPixelsAround(
      epicentre,
      (pixel, distance) => Math.abs(distance - minPx) <= 0.5 && isOffNeedle(pixel),
    );
    expect(stroke.length).toBeGreaterThanOrEqual(4);
    for (const pixel of stroke) {
      expect(getDiffLevel(empty, rest, pixel)).toBeGreaterThan(PAINT_THRESHOLD);
    }
  });

  it('never draws a Felt ring smaller than the epicentre plus 3 px', async () => {
    const { empty, rest } = await renderRings([CENTRE_M3, LIMB_M3]);

    const minPx = getMinRingRadiusPx(3);
    expect(getFeltRingAngle(3, 10) * RADIUS).toBeLessThan(minPx - 2);
    const outermost = getOutermostPaintedDistance(empty, rest, CENTRE, 15);
    expect(outermost).toBeGreaterThanOrEqual(minPx);
    expect(outermost).toBeLessThanOrEqual(minPx + 2);

    expect(getRotatedZ(LIMB_M3)).toBeCloseTo(0.3, 1);
    const { epicentre, hypocentre } = getQuakePoints(LIMB_M3);
    const isOffNeedle = (pixel: Point) => getSegmentDistance(pixel, epicentre, hypocentre) > 2;
    const stroke = getPixelsAround(
      epicentre,
      (pixel, distance) => Math.abs(distance - minPx) <= 0.5 && isOffNeedle(pixel),
    );
    expect(stroke.length).toBeGreaterThanOrEqual(4);
    for (const pixel of stroke) {
      expect(getDiffLevel(empty, rest, pixel)).toBeGreaterThan(PAINT_THRESHOLD);
    }
    const outside = getPixelsAround(
      epicentre,
      (pixel, distance) => distance >= minPx + 2 && distance <= minPx + 4 && isOffNeedle(pixel),
    );
    expect(outside.filter((pixel) => getDiffLevel(empty, rest, pixel) > PAINT_THRESHOLD)).toEqual(
      [],
    );
  });

  it('keeps the rings still when no waves are played', async () => {
    const { snapshot } = await renderRings([WAVE_M7, HOLLOW_M4]);
    const clock = freezeClock();

    await waitFrames(2);
    const first = snapshot();
    clock.advance(1000);
    await waitFrames(2);
    const second = snapshot();
    clock.restore();
    expect(getChangedPixelCount(first, second)).toBe(0);
  });

  it('grows the S front to the Felt reach with the P front ahead, then rests', async () => {
    const { empty, rest, snapshot } = await renderRings([WAVE_M7]);
    const clock = freezeClock();
    const life = getWaveLifeSeconds(7);
    const fronts = getWaveFronts({
      progress: 0.5,
      reachKm: getFeltReachKm({ magnitude: 7, depthKm: 10 }),
      depthKm: 10,
    });

    await waitFrames(2);
    stubReducedMotion(false);
    playWaves();
    await waitFrames(2);
    clock.advance(life * 500);
    await waitFrames(2);
    const mid = snapshot();
    clock.advance(life * 1000);
    await waitFrames(2);
    const after = snapshot();
    clock.restore();

    expect(life).toBe(4);
    const sFront = RADIUS * Math.sin(fronts.sAngle);
    expect(sFront).toBeCloseTo(37, 0);
    const s = getPeakDistance(rest, mid, CENTRE, [28, 50]);
    expect(Math.abs(s - sFront)).toBeLessThanOrEqual(sFront * 0.05);
    expect(getDiffLevel(rest, mid, { x: CX + s, y: CY })).toBeGreaterThan(PAINT_THRESHOLD);
    expect(fronts.pAngle).not.toBeNull();
    const pFront = RADIUS * Math.sin(fronts.pAngle ?? 0);
    const p = getPeakDistance(rest, mid, CENTRE, [50, 62]);
    expect(Math.abs(p - pFront)).toBeLessThanOrEqual(pFront * 0.05);
    expect(getDiffLevel(rest, mid, { x: CX + p, y: CY })).toBeGreaterThan(PAINT_THRESHOLD);
    const ringEdge = getPeakDistance(empty, rest, CENTRE, [60, 90]);
    expect(ringEdge).toBeCloseTo(RADIUS * Math.sin(getFeltRingAngle(7, 10)), -0.5);
    expect(getDiffLevel(empty, mid, { x: CX + ringEdge, y: CY })).toBeLessThanOrEqual(
      PAINT_THRESHOLD,
    );
    expect(getChangedPixelCount(rest, after)).toBe(0);
  });

  it('keeps the rings static when waves are played under reduced motion', async () => {
    const { rest, snapshot } = await renderRings([WAVE_M7]);
    const clock = freezeClock();

    await waitFrames(2);
    playWaves();
    await waitFrames(2);
    const played = snapshot();
    clock.advance(getWaveLifeSeconds(7) * 500);
    await waitFrames(2);
    const later = snapshot();
    clock.restore();
    expect(getChangedPixelCount(rest, played)).toBe(0);
    expect(getChangedPixelCount(rest, later)).toBe(0);
  });

  it('hides far-side rings and clips ring parts past the limb', async () => {
    const { empty, rest } = await renderRings([ANTIPODE_M8, LIMB_M7]);

    expect(getRotatedZ(ANTIPODE_M8)).toBeCloseTo(-1, 6);
    expect(getFeltRingAngle(8, 10)).toBeGreaterThan(0.5);
    expect(getPaintedDiffCount(empty, rest, CENTRE, 40)).toBe(0);

    const limb = getQuakePoints(LIMB_M7).epicentre;
    expect(getRotatedZ(LIMB_M7)).toBeCloseTo(0.18, 1);
    const box = getPixelGrid(
      { x: limb.x - 30, y: limb.y - 90 },
      { x: CX + RADIUS + 30, y: limb.y + 90 },
    );
    const isPainted = (pixel: Point) => getDiffLevel(empty, rest, pixel) > PAINT_THRESHOLD;
    const inside = box.filter((pixel) => getDistance(pixel, CENTRE) < RADIUS - 1);
    const outside = box.filter((pixel) => getDistance(pixel, CENTRE) > RADIUS + 1);
    expect(outside.length).toBeGreaterThan(100);
    expect(inside.filter(isPainted).length).toBeGreaterThan(100);
    expect(outside.filter(isPainted)).toEqual([]);
  });

  it('keeps the shell and says so inline when WebGL is missing', async () => {
    stubWebGL(0);
    const { screen } = await renderGlobe();

    await expect
      .element(screen.getByRole('status'))
      .toHaveTextContent("Your browser can't draw the globe.");
    expect(screen.container.querySelector('canvas')).toBeNull();
  });

  it('falls back to the same line when the renderer cannot start', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubWebGL(1);
    const { screen } = await renderGlobe();

    await expect
      .element(screen.getByRole('status'))
      .toHaveTextContent("Your browser can't draw the globe.");
  });

  it('speaks Spanish without WebGL', async () => {
    overwriteGetLocale(() => 'es');
    stubWebGL(0);
    const { screen } = await renderGlobe();

    await expect
      .element(screen.getByRole('status'))
      .toHaveTextContent('Tu navegador no puede dibujar el globo.');
  });
});

describe('globe controls', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('drifts while idle and caps a long frame at 0.1 s', async () => {
    const { controls } = await renderControls();

    const capped = controls.advance(5, 0).lon - INITIAL_VIEW.lon;
    expect(capped).toBeCloseTo(0.1 * 0.0133, 6);
  });

  it('ignores moves under the 4 px drag threshold', async () => {
    const { controls, pointer } = await renderControls();

    pointer('pointerdown', 100);
    pointer('pointermove', 103);
    pointer('pointerup', 103);
    expect(controls.viewRef.current).toEqual(INITIAL_VIEW);
  });

  it('rotates by the dragged distance over the radius and stops drifting after', async () => {
    const { controls, pointer, step } = await renderControls();

    pointer('pointerdown', 100);
    pointer('pointermove', 200, { time: 0 });
    pointer('pointerup', 200, { time: 80 });
    const dragged = controls.viewRef.current;
    expect(dragged.lon).toBeCloseTo(INITIAL_VIEW.lon - 100 / RADIUS, 6);
    expect(step(60)).toEqual(dragged);
  });

  it('keeps spinning after a flick and stops within a second', async () => {
    const { controls, flick, step } = await renderControls();

    flick();
    const released = controls.viewRef.current.lon;
    expect(step(1).lon).toBeLessThan(released);
    const settled = step(59).lon;
    expect(step(10).lon).toBe(settled);
  });

  it('caps a flick sampled 1 ms apart so it still stops within a second', async () => {
    const { controls, flick, step } = await renderControls();

    flick({ sampleMs: 1 });
    const released = controls.viewRef.current.lon;
    const firstFrameTravel = released - step(1).lon;
    expect(firstFrameTravel).toBeGreaterThan(0);
    expect(firstFrameTravel).toBeLessThanOrEqual(MAX_RELEASE_SPEED * FRAME);
    const settled = step(59).lon;
    expect(step(10).lon).toBe(settled);
  });

  it('does not coast when the pointer paused before release', async () => {
    const { controls, flick, step } = await renderControls();

    flick({ pauseMs: 60 });
    const released = controls.viewRef.current;
    expect(step(60)).toEqual(released);
  });

  it('keeps a wheel zoom made mid-drag when the drag continues', async () => {
    const { controls, pointer, wheel } = await renderControls();

    pointer('pointerdown', 100);
    pointer('pointermove', 120);
    wheel(-200);
    pointer('pointermove', 140);
    expect(controls.viewRef.current.zoom).toBeGreaterThan(1);
  });

  it('stops the idle drift after a wheel zoom alone', async () => {
    const { controls, wheel, step } = await renderControls();

    wheel(-200);
    const zoomed = controls.viewRef.current;
    expect(step(60)).toEqual(zoomed);
  });

  it('zooms with the wheel between 1 and 5 and keeps the page from scrolling', async () => {
    const { controls, wheel } = await renderControls();

    for (let i = 0; i < 20; i++) expect(wheel(-200).defaultPrevented).toBe(true);
    expect(controls.viewRef.current.zoom).toBe(5);
    for (let i = 0; i < 20; i++) wheel(200);
    expect(controls.viewRef.current.zoom).toBe(1);
  });

  it('zooms by the pinch distance ratio', async () => {
    const { controls, pointer } = await renderControls();

    pointer('pointerdown', 100, { id: 1 });
    pointer('pointerdown', 200, { id: 2 });
    pointer('pointermove', 300, { id: 2 });
    expect(controls.viewRef.current.zoom).toBeCloseTo(2, 6);
    expect(controls.viewRef.current.lon).toBe(INITIAL_VIEW.lon);
  });

  it('neither drifts nor coasts under reduced motion', async () => {
    stubReducedMotion(true);
    const { controls, flick, step } = await renderControls();

    expect(step(180)).toEqual(INITIAL_VIEW);
    flick();
    const released = controls.viewRef.current;
    expect(step(60)).toEqual(released);
  });
});
