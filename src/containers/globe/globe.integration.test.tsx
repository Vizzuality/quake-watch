import { invalidate } from '@react-three/fiber';
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
  type GlobeControlsOptions,
  MAX_RELEASE_SPEED,
  useGlobeControls,
} from '@/containers/globe/use-globe-controls';
import { CAMERA_DEBOUNCE_MS, type Camera } from '@/hooks/use-camera-search';
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
import { getFramedLongitude } from '@/lib/globe/framing';
import {
  FLY_DURATION_MS,
  type GlobeView,
  INITIAL_VIEW,
  SELECT_MIN_ZOOM,
  ZOOM_RANGE,
  getFlyView,
} from '@/lib/globe/motion';
import { QUAKE_MARKER_LOOK, getEpicentreRadiusPx, getHypocentreRadius } from '@/lib/globe/quakes';
import { getLatLonVector, getRotatedVector } from '@/lib/globe/sphere';
import { overwriteGetLocale } from '@/paraglide/runtime';
import { getEmscFeature, getFeatureCollection } from '@/test/fixtures/earthquakes';
import { stubFetch } from '@/test/stub-fetch';

type Point = { x: number; y: number };
type Snapshot = { data: Uint8Array; width: number; height: number; dpr: number };
type TestQuake = {
  lat: number;
  lon: number;
  depth: number;
  mag: number;
  region?: string | null;
  time?: string;
};

const WIDTH = 1280;
const HEIGHT = 800;
const { cx: CX, cy: CY, radius: RADIUS } = getGlobeFrame(WIDTH, HEIGHT);
const CENTRE: Point = { x: CX, y: CY };
const FRAME = 1 / 60;
const IDLE_FRAMES = 180;
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

function spyOnRenders() {
  const clear = vi.spyOn(WebGL2RenderingContext.prototype, 'clear');
  async function getRendersDuring(wait: Promise<unknown>): Promise<number> {
    const before = clear.mock.calls.length;
    await wait;
    return clear.mock.calls.length - before;
  }
  return {
    getRendersDuring,
    getRendersOver: (frames: number) => getRendersDuring(waitFrames(frames)),
  };
}

function waitForQueryData(queryClient: QueryClient): Promise<void> {
  return new Promise((resolve) => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') return;
      unsubscribe();
      resolve();
    });
  });
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
  const features = quakes.map(({ lat, lon, depth, mag, region, time }, index) =>
    getEmscFeature({ id: `test_${index}`, lat, lon, depth, mag, region, time }),
  );
  return Response.json(getFeatureCollection(features));
}

function isListRequest(url: URL): boolean {
  return url.pathname === LIST_PATH;
}

async function renderGlobe(
  quakesByMinMagnitude: Partial<Record<MinMagnitude, TestQuake[]>> = {},
  {
    initialEntries = ['/'],
    responseGate,
  }: { initialEntries?: string[]; responseGate?: Promise<void> } = {},
) {
  vi.spyOn(Element.prototype, 'setPointerCapture').mockImplementation(() => {});
  const fetchMock = stubFetch([
    ...Object.entries(quakesByMinMagnitude).map(([minmag, quakes]) => ({
      match: (url: URL) => isListRequest(url) && url.searchParams.get('minmagnitude') === minmag,
      respond: async () => {
        await responseGate;
        return getQuakeResponse(quakes);
      },
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
    history: createMemoryHistory({ initialEntries }),
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

  async function settle(): Promise<void> {
    await expect.poll(() => fetchMock.mock.calls.length).toBeGreaterThan(0);
    await expect.poll(() => queryClient.isFetching()).toBe(0);
    await vi.waitFor(getCanvas);
    await waitFrames(10);
  }

  async function getSettledSnapshot(): Promise<Snapshot> {
    await settle();
    return getSnapshot(getCanvas());
  }

  async function showMinMagnitude(minmag: MinMagnitude): Promise<Snapshot> {
    const calls = fetchMock.mock.calls.length;
    await router.navigate({ to: '/', search: { minmag } });
    await expect.poll(() => fetchMock.mock.calls.length).toBeGreaterThan(calls);
    return getSettledSnapshot();
  }

  return { screen, router, queryClient, getCanvas, settle, getSettledSnapshot, showMinMagnitude };
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

async function renderControls(options?: GlobeControlsOptions) {
  const controlsRef = createRef<GlobeControls>();

  function Probe() {
    const targetRef = useRef<HTMLDivElement>(null);
    const controls = useGlobeControls(targetRef, options);
    useImperativeHandle(controlsRef, () => controls, [controls]);
    return <div ref={targetRef} data-testid="target" style={{ width: WIDTH, height: HEIGHT }} />;
  }

  const screen = await render(<Probe />);
  const target = screen.getByTestId('target').element() as HTMLElement;
  vi.spyOn(target, 'setPointerCapture').mockImplementation(() => {});
  if (!controlsRef.current) throw new Error('controls probe did not mount');
  const controls = controlsRef.current;

  function pointer(type: string, x: number, { y = 100, id = 1, time = 0, button = 0 } = {}) {
    const event = new PointerEvent(type, {
      pointerId: id,
      clientX: x,
      clientY: y,
      button,
      bubbles: true,
    });
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

  return { controls, target, pointer, wheel, step, flick };
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
    const { getRendersOver } = spyOnRenders();
    const clock = freezeClock();

    await waitFrames(2);
    const first = snapshot();
    clock.advance(1000);
    invalidate();
    expect(await getRendersOver(2)).toBeGreaterThanOrEqual(1);
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
    const { getRendersOver } = spyOnRenders();
    const clock = freezeClock();

    await waitFrames(2);
    playWaves();
    invalidate();
    expect(await getRendersOver(2)).toBeGreaterThanOrEqual(1);
    const played = snapshot();
    clock.advance(getWaveLifeSeconds(7) * 500);
    invalidate();
    expect(await getRendersOver(2)).toBeGreaterThanOrEqual(1);
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

const TOOLTIP_M5: TestQuake = {
  lat: VIEW_LAT,
  lon: VIEW_LON,
  depth: 10,
  mag: 5.1,
  time: '2026-10-31T04:12:00Z',
};
const QUIET_M3: TestQuake = {
  lat: VIEW_LAT + 20,
  lon: VIEW_LON - 30,
  depth: 500,
  mag: 3,
  region: null,
};
const COMPACT_M4: TestQuake = { lat: VIEW_LAT + 10, lon: VIEW_LON + 15, depth: 35, mag: 4.3 };
const TOOLTIP_NOW = new Date('2026-10-31T07:30:00Z');
const EDGE_M4: TestQuake = { lat: VIEW_LAT - 70, lon: VIEW_LON + 20, depth: 10, mag: 4 };
const PICK_QUAKES: TestQuake[] = [
  { lat: VIEW_LAT, lon: VIEW_LON, depth: 10, mag: 4, region: 'QUAKE A' },
  { lat: VIEW_LAT + 25, lon: VIEW_LON - 30, depth: 10, mag: 4, region: 'QUAKE B' },
  { lat: VIEW_LAT - 25, lon: VIEW_LON + 35 - 360, depth: 10, mag: 4, region: 'QUAKE C' },
  { lat: VIEW_LAT + 5, lon: VIEW_LON + 60 - 360, depth: 10, mag: 4, region: 'QUAKE D' },
];
const BEHIND_A: TestQuake = {
  lat: -VIEW_LAT,
  lon: VIEW_LON - 180,
  depth: 10,
  mag: 4,
  region: 'BEHIND',
};
const BEHIND_ALONE: TestQuake = {
  lat: -VIEW_LAT - 30,
  lon: VIEW_LON - 180,
  depth: 10,
  mag: 4,
  region: 'BEHIND',
};
const PICK_OFFSET_PX = 11.9;
const BOARD_VIEW_PATH = '/?lat=6.88&lon=150&zoom=1';
const FRAME_QUAKES: TestQuake[] = [-41, -33, -30, -26, -19, 150].map((lon) => ({
  lat: 10,
  lon,
  depth: 10,
  mag: 4,
}));
const FRAME_LON =
  getFramedLongitude(FRAME_QUAKES.map(({ lon, mag }) => ({ longitude: lon, magnitude: mag }))) ??
  Number.NaN;
const OTHER_FRAME_QUAKES: TestQuake[] = [80, 85, 90].map((lon) => ({
  lat: 10,
  lon,
  depth: 10,
  mag: 4,
}));
const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const;

function getDegreesInRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function getCentredViewPoint(quake: TestQuake, centre: TestQuake, zoom: number): Point {
  const [x, y] = getRotatedVector(
    getLatLonVector(quake.lat, quake.lon),
    getDegreesInRadians(centre.lon),
    getDegreesInRadians(centre.lat),
  );
  return { x: CX + x * RADIUS * zoom, y: CY - y * RADIUS * zoom };
}

function getQuakeSearch(router: { state: { location: { search: unknown } } }): string | undefined {
  return (router.state.location.search as { quake?: string }).quake;
}

function getCameraSearch(router: { state: { location: { search: unknown } } }): Partial<Camera> {
  const { lat, lon, zoom } = router.state.location.search as Partial<Camera>;
  return { lat, lon, zoom };
}

function getHistoryIndex(router: {
  history: { location: { state: unknown } };
}): number | undefined {
  return (router.history.location.state as { __TSR_index?: number }).__TSR_index;
}

function getGlobeView(): Camera {
  const view = window.__globeView?.();
  if (!view) throw new Error('globe view is not exposed');
  return view;
}

function getLonDistance(a: number, b: number): number {
  return Math.abs(((((a - b) % 360) + 540) % 360) - 180);
}

function getCameraUrlError(router: { state: { location: { search: unknown } } }): number {
  const { lat, lon, zoom } = getCameraSearch(router);
  if (lat === undefined || lon === undefined || zoom === undefined) return Infinity;
  const view = getGlobeView();
  return Math.max(
    Math.abs(lat - view.lat),
    getLonDistance(lon, view.lon),
    Math.abs(zoom - view.zoom),
  );
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function renderTooltipGlobe(
  quakes: TestQuake[],
  { initialEntries = [BOARD_VIEW_PATH], reducedMotion = true } = {},
) {
  stubReducedMotion(reducedMotion);
  const globe = await renderGlobe({ 0: quakes }, { initialEntries });
  await globe.settle();
  const container = globe.screen.getByRole('img').element() as HTMLElement;
  const rect = container.getBoundingClientRect();

  function pointer(type: string, { x, y }: Point) {
    container.dispatchEvent(
      new PointerEvent(type, {
        pointerId: 1,
        button: 0,
        bubbles: true,
        clientX: rect.left + x,
        clientY: rect.top + y,
      }),
    );
  }

  function getTooltip(): HTMLElement | null {
    return document.querySelector('[role="tooltip"]');
  }

  async function hover(point: Point): Promise<HTMLElement> {
    pointer('pointermove', point);
    return vi.waitFor(() => {
      const tooltip = getTooltip();
      if (!tooltip) throw new Error('tooltip is not shown');
      return tooltip;
    });
  }

  function tap(point: Point) {
    pointer('pointerdown', point);
    pointer('pointerup', point);
  }

  function drag(from: Point, by: Point) {
    pointer('pointerdown', from);
    for (let i = 1; i <= 4; i++) {
      pointer('pointermove', { x: from.x + (by.x * i) / 4, y: from.y + (by.y * i) / 4 });
    }
    pointer('pointerup', { x: from.x + by.x, y: from.y + by.y });
  }

  function wheel(deltaY: number) {
    container.dispatchEvent(new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true }));
  }

  function getLivePoint(key: string): Point {
    const point = window.__globeQuakePoints?.().find(({ id }) => id === key);
    if (!point) throw new Error(`${key} is not on the front side`);
    return { x: point.x - rect.left, y: point.y - rect.top };
  }

  function moveOntoTooltip(tooltip: HTMLElement) {
    container.dispatchEvent(
      new PointerEvent('pointerout', { bubbles: true, relatedTarget: tooltip }),
    );
    container.dispatchEvent(new PointerEvent('pointerleave', { relatedTarget: tooltip }));
    tooltip.dispatchEvent(
      new PointerEvent('pointerover', { bubbles: true, relatedTarget: container }),
    );
  }

  function leaveTooltip(tooltip: HTMLElement) {
    tooltip.dispatchEvent(
      new PointerEvent('pointerout', { bubbles: true, relatedTarget: document.body }),
    );
  }

  return {
    ...globe,
    container,
    pointer,
    getTooltip,
    hover,
    tap,
    drag,
    wheel,
    getLivePoint,
    moveOntoTooltip,
    leaveTooltip,
  };
}

describe('globe quake tooltip', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    overwriteGetLocale(() => 'en');
  });

  it('shows the Full tooltip within 100 ms with the Figma measurements', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5]);

    const start = performance.now();
    globe.pointer('pointermove', getScreenPoint(TOOLTIP_M5.lat, TOOLTIP_M5.lon, 1));
    await waitFrames(1);
    const tooltip = globe.getTooltip();
    expect(performance.now() - start).toBeLessThan(100);
    if (!tooltip) throw new Error('tooltip is not shown');

    const style = getComputedStyle(tooltip);
    expect(style.width).toBe('248px');
    expect(style.padding).toBe('16px');
    expect(style.rowGap).toBe('8px');
    expect(style.borderTopWidth).toBe('1px');
    expect(style.borderRadius).toBe('0px');
    expect(style.backdropFilter).toContain('blur(50px)');
    const magnitude = globe.screen.getByText('M5.1').element();
    expect(getComputedStyle(magnitude).fontSize).toBe('28px');
    expect(getComputedStyle(magnitude).fontWeight).toBe('300');
    const dot = tooltip.querySelector('span[aria-hidden="true"]') as HTMLElement;
    expect(getComputedStyle(dot).width).toBe('8px');
    await expect.element(globe.screen.getByRole('button', { name: 'Click to open' })).toBeVisible();
    expect(globe.container.getAttribute('aria-describedby')).toBe(tooltip.id);
  });

  it('labels magnitude, age, place, date, Depth and Likely felt', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: TOOLTIP_NOW });
    const globe = await renderTooltipGlobe([TOOLTIP_M5, QUIET_M3]);

    const tooltip = globe.screen.getByRole('tooltip');
    await globe.hover(getScreenPoint(TOOLTIP_M5.lat, TOOLTIP_M5.lon, 1));
    for (const text of [
      'M5.1',
      '3 h ago',
      'Southern Spain',
      'Sat 31.10 · 04:12 UTC',
      'Depth',
      '10 km',
      'Likely felt',
      '~210 km',
    ]) {
      await expect.element(tooltip.getByText(text, { exact: true })).toBeVisible();
    }

    await globe.hover(getScreenPoint(QUIET_M3.lat, QUIET_M3.lon, 1));
    await expect.element(tooltip.getByText('Unknown location', { exact: true })).toBeVisible();
    await expect.element(tooltip.getByText('Not felt', { exact: true })).toBeVisible();
    await expect.element(tooltip.getByText('500 km', { exact: true })).toBeVisible();
  });

  it('speaks Spanish', async () => {
    overwriteGetLocale(() => 'es');
    vi.useFakeTimers({ toFake: ['Date'], now: TOOLTIP_NOW });
    const globe = await renderTooltipGlobe([TOOLTIP_M5]);

    const tooltip = globe.screen.getByRole('tooltip');
    await globe.hover(getScreenPoint(TOOLTIP_M5.lat, TOOLTIP_M5.lon, 1));
    for (const text of [
      'M5,1',
      'hace 3 h',
      'sáb 31.10 · 04:12 UTC',
      'Profundidad',
      'Probablemente sentido',
      'Abrir detalles',
    ]) {
      await expect.element(tooltip.getByText(text, { exact: true })).toBeVisible();
    }
  });

  it('picks every front-side quake within 12 px of its epicentre and never a far-side one', async () => {
    const globe = await renderTooltipGlobe([...PICK_QUAKES, BEHIND_A, BEHIND_ALONE]);
    const tooltip = globe.screen.getByRole('tooltip');

    for (const [dx, dy] of DIRECTIONS) {
      for (const [index, quake] of PICK_QUAKES.entries()) {
        const epicentre = getScreenPoint(quake.lat, quake.lon, 1);
        globe.pointer('pointermove', {
          x: epicentre.x + dx * PICK_OFFSET_PX,
          y: epicentre.y + dy * PICK_OFFSET_PX,
        });
        await expect.element(tooltip).toMatchTextContent(`Quake ${'ABCD'.charAt(index)}`);
      }
    }
    globe.pointer('pointermove', getScreenPoint(BEHIND_A.lat, BEHIND_A.lon, 1));
    await expect.element(tooltip).toMatchTextContent('Quake A');

    globe.pointer('pointerleave', CENTRE);
    await expect.poll(globe.getTooltip).toBeNull();
    const behind = getScreenPoint(BEHIND_ALONE.lat, BEHIND_ALONE.lon, 1);
    for (const quake of PICK_QUAKES) {
      expect(getDistance(behind, getScreenPoint(quake.lat, quake.lon, 1))).toBeGreaterThan(30);
    }
    globe.pointer('pointermove', behind);
    await waitFrames(5);
    expect(globe.getTooltip()).toBeNull();
  });

  it('stays open while the pointer moves onto it and hides 150 ms after leaving both', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5]);

    const tooltip = await globe.hover(getScreenPoint(TOOLTIP_M5.lat, TOOLTIP_M5.lon, 1));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    globe.moveOntoTooltip(tooltip);
    vi.advanceTimersByTime(500);
    await waitFrames(2);
    expect(globe.getTooltip()).toBe(tooltip);

    globe.leaveTooltip(tooltip);
    vi.advanceTimersByTime(100);
    await waitFrames(2);
    expect(globe.getTooltip()).toBe(tooltip);
    vi.advanceTimersByTime(50);
    await waitFrames(3);
    expect(globe.getTooltip()).toBeNull();
  });

  it('hides on Escape without moving the pointer', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5]);

    await globe.hover(getScreenPoint(TOOLTIP_M5.lat, TOOLTIP_M5.lon, 1));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await waitFrames(3);
    expect(globe.getTooltip()).toBeNull();
  });

  it('shows the Compact tooltip while a quake is selected', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5, COMPACT_M4], {
      initialEntries: ['/?quake=emsc:test_0'],
    });

    const tooltip = await globe.hover(globe.getLivePoint('emsc:test_1'));
    const style = getComputedStyle(tooltip);
    expect(style.padding).toBe('12px');
    expect(style.rowGap).toBe('4px');
    expect(tooltip.querySelector('button')).toBeNull();
    const magnitude = globe.screen.getByText('M4.3').element();
    expect(getComputedStyle(magnitude).fontSize).toBe('12px');
    expect(getComputedStyle(magnitude).fontWeight).toBe('500');
    const dot = tooltip.querySelector('span[aria-hidden="true"]') as HTMLElement;
    expect(getComputedStyle(dot).width).toBe('6px');
    const place = globe.screen.getByText('Southern Spain').element();
    expect(getComputedStyle(place).fontSize).toBe('11px');
    expect(getComputedStyle(place).lineHeight).toBe('13.2px');
  });

  it('pushes a tapped quake to the URL and flies 900 ms to centre it at zoom 5', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5, COMPACT_M4], { reducedMotion: false });
    const clock = freezeClock();
    await waitFrames(2);

    const start = globe.getLivePoint('emsc:test_1');
    globe.tap(start);
    await expect.poll(() => getQuakeSearch(globe.router)).toBe('emsc:test_1');
    expect(globe.router.history.length).toBe(2);
    clock.advance(FLY_DURATION_MS / 2);
    await waitFrames(2);
    const mid = getDistance(globe.getLivePoint('emsc:test_1'), CENTRE);
    expect(mid).toBeGreaterThan(1);
    clock.advance(FLY_DURATION_MS);
    await waitFrames(2);
    clock.restore();

    expect(getDistance(globe.getLivePoint('emsc:test_1'), CENTRE)).toBeLessThanOrEqual(1);
    const other = getCentredViewPoint(TOOLTIP_M5, COMPACT_M4, ZOOM_RANGE[1]);
    expect(getDistance(globe.getLivePoint('emsc:test_0'), other)).toBeLessThanOrEqual(1);
    globe.router.history.back();
    await expect.poll(() => getQuakeSearch(globe.router)).toBeUndefined();
  });

  it('selects the hovered quake from Click to open', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5, COMPACT_M4]);

    await globe.hover(getScreenPoint(COMPACT_M4.lat, COMPACT_M4.lon, 1));
    (globe.screen.getByRole('button', { name: 'Click to open' }).element() as HTMLElement).click();
    await expect.poll(() => getQuakeSearch(globe.router)).toBe('emsc:test_1');
    expect(getDistance(globe.getLivePoint('emsc:test_1'), CENTRE)).toBeLessThanOrEqual(1);
    await expect.poll(globe.getTooltip).toBeNull();
  });

  it('does not select a quake after a drag of 4 px or more', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5]);
    const point = getScreenPoint(TOOLTIP_M5.lat, TOOLTIP_M5.lon, 1);

    globe.pointer('pointerdown', point);
    globe.pointer('pointermove', { x: point.x + 4, y: point.y });
    globe.pointer('pointerup', { x: point.x + 4, y: point.y });
    globe.tap({ x: CX - 150, y: CY + 100 });
    await waitFrames(5);
    expect(getQuakeSearch(globe.router)).toBeUndefined();
  });

  it('flies to the quake in the URL once the data arrives', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5, COMPACT_M4], {
      initialEntries: ['/?quake=emsc:test_1'],
      reducedMotion: false,
    });

    await expect
      .poll(() => getDistance(globe.getLivePoint('emsc:test_1'), CENTRE), { timeout: 3000 })
      .toBeLessThanOrEqual(1);
  });

  it('keeps drifting without an error for an unknown quake in the URL', async () => {
    const consoleError = vi.spyOn(console, 'error');
    const globe = await renderTooltipGlobe([TOOLTIP_M5], {
      initialEntries: ['/?quake=emsc:missing'],
      reducedMotion: false,
    });

    const before = globe.getLivePoint('emsc:test_0');
    await waitFrames(30);
    expect(Math.abs(globe.getLivePoint('emsc:test_0').x - before.x)).toBeGreaterThan(0.5);
    expect(getQuakeSearch(globe.router)).toBe('emsc:missing');
    expect(globe.screen.container.querySelector('output')).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('jumps to the tapped quake in one frame under reduced motion', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5, COMPACT_M4]);
    const { getRendersOver } = spyOnRenders();

    expect(await getRendersOver(5)).toBe(0);
    globe.tap(getScreenPoint(COMPACT_M4.lat, COMPACT_M4.lon, 1));
    expect(await getRendersOver(1)).toBeGreaterThanOrEqual(1);
    expect(getDistance(globe.getLivePoint('emsc:test_1'), CENTRE)).toBeLessThanOrEqual(1);
  });

  it('stops the drift while hovering or selecting and leaves the camera on Back', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5, COMPACT_M4], {
      initialEntries: ['/'],
      reducedMotion: false,
    });
    await waitMs(FLY_DURATION_MS + 100);

    const drifting = globe.getLivePoint('emsc:test_0');
    await waitFrames(20);
    expect(globe.getLivePoint('emsc:test_0')).not.toEqual(drifting);

    await globe.hover(globe.getLivePoint('emsc:test_0'));
    await waitFrames(2);
    const hovered = globe.getLivePoint('emsc:test_0');
    await waitFrames(30);
    expect(globe.getLivePoint('emsc:test_0')).toEqual(hovered);

    globe.tap(globe.getLivePoint('emsc:test_1'));
    await expect
      .poll(() => getDistance(globe.getLivePoint('emsc:test_1'), CENTRE), { timeout: 3000 })
      .toBeLessThanOrEqual(1);
    await new Promise((resolve) => setTimeout(resolve, FLY_DURATION_MS));
    globe.pointer('pointerleave', CENTRE);
    const selected = globe.getLivePoint('emsc:test_0');
    await waitFrames(30);
    expect(globe.getLivePoint('emsc:test_0')).toEqual(selected);

    globe.router.history.back();
    await expect.poll(() => getQuakeSearch(globe.router)).toBeUndefined();
    await waitFrames(30);
    expect(globe.getLivePoint('emsc:test_0')).toEqual(selected);
  });

  it('hides the tooltip during a fly and keeps it hidden while the globe moves under the pointer', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5, COMPACT_M4], { reducedMotion: false });
    const clock = freezeClock();
    await waitFrames(2);

    await globe.hover(globe.getLivePoint('emsc:test_0'));
    const target = globe.getLivePoint('emsc:test_1');
    globe.tap(target);
    await expect.poll(globe.getTooltip).toBeNull();
    clock.advance(FLY_DURATION_MS / 3);
    await waitFrames(2);
    globe.pointer('pointermove', globe.getLivePoint('emsc:test_0'));
    await waitFrames(2);
    expect(globe.getTooltip()).toBeNull();
    globe.pointer('pointermove', target);
    await waitFrames(2);
    clock.restore();
    expect(globe.getTooltip()).toBeNull();
  });

  it('hides the tooltip at once on a wheel zoom', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5]);

    await globe.hover(getScreenPoint(TOOLTIP_M5.lat, TOOLTIP_M5.lon, 1));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    globe.container.dispatchEvent(
      new WheelEvent('wheel', { deltaY: -200, bubbles: true, cancelable: true }),
    );
    await waitFrames(3);
    expect(globe.getTooltip()).toBeNull();
  });

  it('keeps the Click to open button out of the tab order', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5]);

    await globe.hover(getScreenPoint(TOOLTIP_M5.lat, TOOLTIP_M5.lon, 1));
    await expect
      .element(globe.screen.getByRole('button', { name: 'Click to open' }))
      .toHaveAttribute('tabindex', '-1');
  });

  it('keeps the measured tooltip 16 px above the bottom edge', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5, EDGE_M4]);

    const edge = getScreenPoint(EDGE_M4.lat, EDGE_M4.lon, 1);
    const tooltip = await globe.hover(edge);
    const rect = tooltip.getBoundingClientRect();
    const container = globe.container.getBoundingClientRect();
    expect(edge.y - 54 + rect.height).toBeGreaterThan(HEIGHT - 16);
    expect(container.bottom - rect.bottom).toBeCloseTo(16, 1);
  });

  it('shows a pointer cursor over a quake and grab elsewhere', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5]);
    const img = globe.screen.getByRole('img');

    await expect.element(img).toHaveClass('cursor-grab');
    await globe.hover(getScreenPoint(TOOLTIP_M5.lat, TOOLTIP_M5.lon, 1));
    await expect.element(img).toHaveClass('cursor-pointer');
    await expect.element(img).not.toHaveClass('cursor-grab');
    globe.pointer('pointermove', { x: CX - 150, y: CY + 100 });
    await expect.element(img).toHaveClass('cursor-grab');
    await expect.element(img).not.toHaveClass('cursor-pointer');
  });
});

describe('globe camera URL', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restores the camera from the URL and holds it without drifting', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5], {
      initialEntries: ['/?lat=35&lon=-120&zoom=2.5'],
      reducedMotion: false,
    });

    const { getRendersOver } = spyOnRenders();
    const restored = getGlobeView();
    expect(Math.abs(restored.lat - 35)).toBeLessThanOrEqual(0.1);
    expect(getLonDistance(restored.lon, -120)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(restored.zoom - 2.5)).toBeLessThanOrEqual(0.05);
    expect(await getRendersOver(30)).toBe(0);
    expect(getGlobeView()).toEqual(restored);
    invalidate();
    expect(await getRendersOver(2)).toBeGreaterThanOrEqual(1);
    expect(getGlobeView()).toEqual(restored);
    expect(getCameraSearch(globe.router)).toEqual({ lat: 35, lon: -120, zoom: 2.5 });
  });

  it('writes the camera in place once a drag and its inertia stop', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5], { reducedMotion: false });
    const { length } = globe.router.history;
    const index = getHistoryIndex(globe.router);

    globe.drag(CENTRE, { x: -120, y: 40 });
    await expect
      .poll(() => getCameraUrlError(globe.router), { timeout: 3000 })
      .toBeLessThanOrEqual(0.01);
    await waitFrames(10);
    expect(getCameraUrlError(globe.router)).toBeLessThanOrEqual(0.01);
    expect(getCameraSearch(globe.router).lon).not.toBe(150);
    expect(globe.router.history.length).toBe(length);
    expect(getHistoryIndex(globe.router)).toBe(index);
  });

  it('adds no history entry over five drags and five wheel zooms', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5]);
    const { length } = globe.router.history;
    const index = getHistoryIndex(globe.router);

    for (let i = 0; i < 5; i++) {
      globe.drag(CENTRE, { x: 30, y: -10 });
      await waitMs(CAMERA_DEBOUNCE_MS + 50);
      expect(getCameraUrlError(globe.router)).toBeLessThanOrEqual(0.01);
      globe.wheel(-100);
      await waitMs(CAMERA_DEBOUNCE_MS + 50);
      expect(getCameraUrlError(globe.router)).toBeLessThanOrEqual(0.01);
    }
    expect(getCameraSearch(globe.router).zoom).toBeGreaterThan(1);
    expect(globe.router.history.length).toBe(length);
    expect(getHistoryIndex(globe.router)).toBe(index);
  });

  it('adds one entry for a tapped quake and writes its centre once the fly lands', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5, COMPACT_M4], { reducedMotion: false });

    globe.tap(globe.getLivePoint('emsc:test_1'));
    await expect.poll(() => getQuakeSearch(globe.router)).toBe('emsc:test_1');
    expect(globe.router.history.length).toBe(2);
    expect(getHistoryIndex(globe.router)).toBe(1);
    await expect
      .poll(() => getLonDistance(getCameraSearch(globe.router).lon ?? Infinity, COMPACT_M4.lon), {
        timeout: 3000,
      })
      .toBeLessThanOrEqual(0.1);
    const camera = getCameraSearch(globe.router);
    expect(Math.abs((camera.lat ?? Infinity) - COMPACT_M4.lat)).toBeLessThanOrEqual(0.1);
    expect(camera.zoom).toBeGreaterThanOrEqual(SELECT_MIN_ZOOM);
    expect(getCameraUrlError(globe.router)).toBeLessThanOrEqual(0.01);
    expect(globe.router.history.length).toBe(2);
    expect(getHistoryIndex(globe.router)).toBe(1);
  });

  it('frames the most active window on a clean load, keeps the URL clean and drifts after', async () => {
    const globe = await renderTooltipGlobe(FRAME_QUAKES, {
      initialEntries: ['/'],
      reducedMotion: false,
    });

    expect(getLonDistance(FRAME_LON, VIEW_LON)).toBeGreaterThan(90);
    await expect
      .poll(() => getLonDistance(getGlobeView().lon, FRAME_LON), { timeout: 3000 })
      .toBeLessThanOrEqual(2.5);
    await waitMs(FLY_DURATION_MS);
    const landed = getGlobeView();
    expect(getLonDistance(landed.lon, FRAME_LON)).toBeLessThanOrEqual(2.5);
    expect(landed.lat).toBeCloseTo(VIEW_LAT, 6);
    expect(landed.zoom).toBe(1);
    await waitFrames(30);
    expect(getGlobeView().lon).not.toBe(landed.lon);
    await waitMs(2 * CAMERA_DEBOUNCE_MS);
    expect(getCameraSearch(globe.router)).toEqual({
      lat: undefined,
      lon: undefined,
      zoom: undefined,
    });
  });

  it('does not reframe when a filter change brings other quakes', async () => {
    stubReducedMotion(true);
    const globe = await renderGlobe({ 0: FRAME_QUAKES, 3: OTHER_FRAME_QUAKES });
    await globe.settle();

    const framed = getGlobeView();
    expect(getLonDistance(framed.lon, FRAME_LON)).toBeLessThan(1e-6);
    await globe.showMinMagnitude(3);
    await waitFrames(10);
    expect(getGlobeView()).toEqual(framed);
  });

  it('does not frame once the globe was dragged before the data arrived', async () => {
    stubReducedMotion(true);
    let respond = () => {};
    const responseGate = new Promise<void>((resolve) => {
      respond = resolve;
    });
    const globe = await renderGlobe({ 0: FRAME_QUAKES }, { responseGate });
    await vi.waitFor(globe.getCanvas);
    await waitFrames(5);
    const container = globe.screen.getByRole('img').element() as HTMLElement;
    const rect = container.getBoundingClientRect();
    for (const [type, dx] of [
      ['pointerdown', 0],
      ['pointermove', 20],
      ['pointermove', 40],
      ['pointerup', 40],
    ] as const) {
      container.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 1,
          button: 0,
          bubbles: true,
          clientX: rect.left + CX + dx,
          clientY: rect.top + CY,
        }),
      );
    }
    const dragged = getGlobeView();
    expect(getLonDistance(dragged.lon, VIEW_LON)).toBeGreaterThan(1);

    respond();
    await globe.settle();
    expect(getGlobeView()).toEqual(dragged);
  });

  it('flies from the URL camera to the URL quake without framing', async () => {
    const globe = await renderTooltipGlobe([COMPACT_M4, ...FRAME_QUAKES], {
      initialEntries: ['/?quake=emsc:test_0&lat=-20&lon=40&zoom=2.5'],
      reducedMotion: false,
    });

    await expect
      .poll(() => getDistance(globe.getLivePoint('emsc:test_0'), CENTRE), { timeout: 3000 })
      .toBeLessThanOrEqual(1);
    await waitMs(FLY_DURATION_MS);
    expect(getDistance(globe.getLivePoint('emsc:test_0'), CENTRE)).toBeLessThanOrEqual(1);
    expect(getGlobeView().zoom).toBe(2.5);
  });

  it('leaves the camera in place on Back and Forward', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5, COMPACT_M4]);

    globe.tap(globe.getLivePoint('emsc:test_1'));
    await expect.poll(() => getQuakeSearch(globe.router)).toBe('emsc:test_1');
    await waitFrames(2);
    const selected = getGlobeView();
    globe.router.history.back();
    await expect.poll(() => getQuakeSearch(globe.router)).toBeUndefined();
    await waitFrames(10);
    expect(getGlobeView()).toEqual(selected);
    globe.router.history.forward();
    await expect.poll(() => getQuakeSearch(globe.router)).toBe('emsc:test_1');
    await waitFrames(10);
    expect(getGlobeView()).toEqual(selected);
  });
});

describe('globe render on demand', { timeout: 30_000 }, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('draws nothing while a touched globe holds still and draws a wheel zoom', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5], { reducedMotion: false });
    const { getRendersOver } = spyOnRenders();

    expect(await getRendersOver(IDLE_FRAMES)).toBe(0);
    globe.wheel(-100);
    expect(await getRendersOver(1)).toBeGreaterThanOrEqual(1);
  });

  it('draws every frame while drifting and nothing while a hover holds the drift', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5], {
      initialEntries: ['/'],
      reducedMotion: false,
    });
    await waitMs(FLY_DURATION_MS + 100);
    const { getRendersOver } = spyOnRenders();

    expect(await getRendersOver(60)).toBeGreaterThanOrEqual(59);
    await globe.hover(globe.getLivePoint('emsc:test_0'));
    await waitFrames(2);
    expect(await getRendersOver(IDLE_FRAMES)).toBe(0);
  });

  it.each(['pointerup', 'pointercancel'])(
    'resumes drawing the drift when a press ends without moving on %s',
    async (type) => {
      const globe = await renderTooltipGlobe([TOOLTIP_M5], {
        initialEntries: ['/'],
        reducedMotion: false,
      });
      await waitMs(FLY_DURATION_MS + 100);
      const { getRendersOver } = spyOnRenders();
      const point = { x: CX, y: CY + RADIUS * 0.95 };

      globe.pointer('pointerdown', point);
      await waitFrames(6);
      globe.pointer(type, point);
      await waitFrames(2);
      const pressed = getGlobeView();
      expect(await getRendersOver(60)).toBeGreaterThanOrEqual(59);
      expect(getGlobeView().lon).not.toBe(pressed.lon);
    },
  );

  it('draws the fly to a selected quake and nothing once it lands', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5, COMPACT_M4], { reducedMotion: false });
    const { getRendersOver } = spyOnRenders();
    const clock = freezeClock();

    expect(await getRendersOver(10)).toBe(0);
    globe.tap(globe.getLivePoint('emsc:test_1'));
    expect(await getRendersOver(10)).toBeGreaterThanOrEqual(9);
    clock.restore();
    await expect
      .poll(() => getCameraUrlError(globe.router), { timeout: 3000 })
      .toBeLessThanOrEqual(0.01);
    expect(getDistance(globe.getLivePoint('emsc:test_1'), CENTRE)).toBeLessThanOrEqual(1);
    await waitFrames(2);
    expect(await getRendersOver(IDLE_FRAMES)).toBe(0);
  });

  it('draws each drag move on a still globe, the inertia after it, then nothing', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5], { reducedMotion: false });
    const { getRendersOver } = spyOnRenders();

    expect(await getRendersOver(10)).toBe(0);
    globe.pointer('pointerdown', CENTRE);
    for (let i = 1; i <= 4; i++) {
      globe.pointer('pointermove', { x: CX - i * 20, y: CY });
      expect(await getRendersOver(1)).toBeGreaterThanOrEqual(1);
    }
    globe.pointer('pointerup', { x: CX - 80, y: CY });
    const clock = freezeClock();
    globe.drag(CENTRE, { x: -80, y: 0 });
    expect(await getRendersOver(10)).toBeGreaterThanOrEqual(9);
    clock.restore();
    await expect
      .poll(() => getCameraUrlError(globe.router), { timeout: 3000 })
      .toBeLessThanOrEqual(0.01);
    await waitFrames(2);
    expect(await getRendersOver(IDLE_FRAMES)).toBe(0);
  });

  it('draws nothing still under reduced motion and draws every wheel and drag event', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5], { initialEntries: ['/'] });
    const { getRendersOver } = spyOnRenders();

    expect(await getRendersOver(IDLE_FRAMES)).toBe(0);
    for (let i = 0; i < 3; i++) {
      globe.wheel(-100);
      expect(await getRendersOver(1)).toBeGreaterThanOrEqual(1);
    }
    globe.pointer('pointerdown', CENTRE);
    for (let i = 1; i <= 3; i++) {
      globe.pointer('pointermove', { x: CX + i * 20, y: CY });
      expect(await getRendersOver(1)).toBeGreaterThanOrEqual(1);
    }
    globe.pointer('pointerup', { x: CX + 60, y: CY });
    await waitFrames(2);
    expect(await getRendersOver(60)).toBe(0);
  });

  it('draws played waves on a still globe until the last one ends, then nothing', async () => {
    await renderTooltipGlobe([WAVE_M7], { reducedMotion: false });
    const { getRendersOver } = spyOnRenders();
    const clock = freezeClock();

    expect(await getRendersOver(10)).toBe(0);
    playWaves();
    expect(await getRendersOver(30)).toBeGreaterThanOrEqual(29);
    clock.advance(getWaveLifeSeconds(7) * 1000 - 50);
    expect(await getRendersOver(30)).toBeGreaterThanOrEqual(29);
    clock.advance(100);
    await waitFrames(2);
    const after = await getRendersOver(IDLE_FRAMES);
    clock.restore();
    expect(after).toBe(0);
  });

  it('redraws a still globe within two frames of a filter change', async () => {
    stubReducedMotion(false);
    stubPreservedDrawingBuffer();
    const globe = await renderGlobe({ 3: [NORTH_QUAKE] }, { initialEntries: [BOARD_VIEW_PATH] });
    const empty = await globe.getSettledSnapshot();
    const { getRendersOver, getRendersDuring } = spyOnRenders();

    expect(await getRendersOver(30)).toBe(0);
    const loaded = waitForQueryData(globe.queryClient);
    const filtered = getRendersDuring(
      (async () => {
        await globe.router.navigate({ to: '/', search: { minmag: 3 } });
        await loaded;
        await waitFrames(2);
      })(),
    );
    expect(await filtered).toBeGreaterThanOrEqual(1);
    const north = getSnapshot(globe.getCanvas());
    expect(
      getPaintedDiffCount(empty, north, getQuakePoints(NORTH_QUAKE).hypocentre, 6),
    ).toBeGreaterThan(0);
  });

  it('starts a fly after a long idle from where the globe stands', async () => {
    const globe = await renderTooltipGlobe([TOOLTIP_M5, COMPACT_M4], { reducedMotion: false });
    const { getRendersOver } = spyOnRenders();

    expect(await getRendersOver(60)).toBe(0);
    const start = globe.getLivePoint('emsc:test_1');
    globe.tap(start);
    expect(await getRendersOver(1)).toBe(1);
    expect(getDistance(globe.getLivePoint('emsc:test_1'), CENTRE)).toBeGreaterThan(
      getDistance(start, CENTRE) * 0.9,
    );
    await expect
      .poll(() => getDistance(globe.getLivePoint('emsc:test_1'), CENTRE), { timeout: 3000 })
      .toBeLessThanOrEqual(1);
  });

  it('redraws a still globe at its new size after a resize', async () => {
    stubPreservedDrawingBuffer();
    const globe = await renderTooltipGlobe([TOOLTIP_M5], { reducedMotion: false });
    const canvas = globe.getCanvas();
    const wrapper = globe.container.parentElement?.parentElement;
    if (!wrapper) throw new Error('globe wrapper is not mounted');
    const resized = getGlobeFrame(700, HEIGHT);
    const { getRendersOver, getRendersDuring } = spyOnRenders();

    expect(await getRendersOver(30)).toBe(0);
    const renders = getRendersDuring(
      (async () => {
        wrapper.style.width = '700px';
        await expect.poll(() => canvas.clientWidth).toBe(700);
        await waitFrames(2);
      })(),
    );
    expect(await renders).toBeGreaterThanOrEqual(1);
    expect(getPaintedPixelCount(canvas, resized.cx - 8, resized.cy - 8, 16)).toBeGreaterThan(0);
    expect(getPaintedPixelCount(canvas, resized.cx + resized.radius * 1.05, resized.cy, 16)).toBe(
      0,
    );
  });

  it('redraws a still globe once its WebGL context is restored', async () => {
    stubPreservedDrawingBuffer();
    const globe = await renderTooltipGlobe([TOOLTIP_M5], { reducedMotion: false });
    const canvas = globe.getCanvas();
    const { getRendersOver } = spyOnRenders();

    expect(await getRendersOver(30)).toBe(0);
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(await getRendersOver(2)).toBeGreaterThanOrEqual(1);
    expect(getPaintedPixelCount(canvas, CX - 8, CY - 8, 16)).toBeGreaterThan(0);
  });
});

const FLY_TARGET: GlobeView = { lon: 1.2, lat: -0.4, zoom: 1.6 };
const IMMEDIATE_HOVER = { immediate: true };

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

  it('flies to a target with ease-in-out over 900 ms and holds it', async () => {
    const { controls, step } = await renderControls();
    const from = controls.viewRef.current;

    controls.flyTo(FLY_TARGET);
    expect(controls.advance(0.45, 0)).toEqual(getFlyView(from, FLY_TARGET, 0.5));
    expect(controls.advance(0.5, 0)).toEqual(FLY_TARGET);
    controls.setHeld(true);
    expect(step(60)).toEqual(FLY_TARGET);
  });

  it('reaches the fly target in one long frame', async () => {
    const { controls } = await renderControls();

    controls.flyTo(FLY_TARGET);
    expect(controls.advance(0.9, 0)).toEqual(FLY_TARGET);
  });

  it('jumps to the fly target under reduced motion', async () => {
    stubReducedMotion(true);
    const { controls, step } = await renderControls();

    controls.flyTo(FLY_TARGET);
    expect(step(1)).toEqual(FLY_TARGET);
  });

  it('cancels the fly on pointerdown', async () => {
    const { controls, pointer, step } = await renderControls();

    controls.flyTo(FLY_TARGET);
    controls.advance(0.3, 0);
    const interrupted = controls.viewRef.current;
    pointer('pointerdown', 100);
    pointer('pointerup', 100);
    expect(step(60)).toEqual(interrupted);
  });

  it('cancels the fly on wheel', async () => {
    const { controls, wheel, step } = await renderControls();

    controls.flyTo(FLY_TARGET);
    controls.advance(0.3, 0);
    wheel(-200);
    const zoomed = controls.viewRef.current;
    expect(step(60)).toEqual(zoomed);
    expect(zoomed).not.toEqual(FLY_TARGET);
  });

  it('does not resume the idle drift after a fly once released', async () => {
    const { controls, step } = await renderControls();

    controls.flyTo(FLY_TARGET);
    controls.setHeld(true);
    controls.advance(1, 0);
    controls.setHeld(false);
    expect(step(60)).toEqual(FLY_TARGET);
  });

  it('pauses the idle drift while held and resumes it after', async () => {
    const { controls, step } = await renderControls();

    controls.setHeld(true);
    expect(step(60)).toEqual(INITIAL_VIEW);
    controls.setHeld(false);
    expect(step(1).lon).not.toBe(INITIAL_VIEW.lon);
  });

  it('reports a tap under the drag threshold relative to the element', async () => {
    const onTap = vi.fn<NonNullable<GlobeControlsOptions['onTap']>>();
    const { target, pointer } = await renderControls({ onTap });
    const rect = target.getBoundingClientRect();

    pointer('pointerdown', 100, { y: 120 });
    pointer('pointermove', 102, { y: 121 });
    pointer('pointerup', 102, { y: 121 });
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith({ x: 102 - rect.left, y: 121 - rect.top });
  });

  it('does not report a tap after a drag, a secondary button or a pinch', async () => {
    const onTap = vi.fn<NonNullable<GlobeControlsOptions['onTap']>>();
    const { pointer } = await renderControls({ onTap });

    pointer('pointerdown', 100);
    pointer('pointermove', 104);
    pointer('pointerup', 104);
    pointer('pointerdown', 100, { button: 2 });
    pointer('pointerup', 100);
    pointer('pointerdown', 100, { id: 1 });
    pointer('pointerdown', 200, { id: 2 });
    pointer('pointerup', 200, { id: 2 });
    pointer('pointerup', 100, { id: 1 });
    expect(onTap).not.toHaveBeenCalled();
  });

  it('reports hover points while idle and clears them on leave and press', async () => {
    const onHover = vi.fn<NonNullable<GlobeControlsOptions['onHover']>>();
    const { target, pointer } = await renderControls({ onHover });
    const rect = target.getBoundingClientRect();

    pointer('pointermove', 300, { y: 200 });
    expect(onHover).toHaveBeenLastCalledWith({ x: 300 - rect.left, y: 200 - rect.top });
    pointer('pointerleave', 300, { y: 200 });
    expect(onHover).toHaveBeenLastCalledWith(null);
    pointer('pointermove', 310, { y: 200 });
    pointer('pointerdown', 310, { y: 200 });
    expect(onHover).toHaveBeenLastCalledWith(null, IMMEDIATE_HOVER);
    const calls = onHover.mock.calls.length;
    pointer('pointermove', 340, { y: 200 });
    expect(onHover).toHaveBeenCalledTimes(calls);
  });

  it('cancels the hover at once when a fly starts and while it runs', async () => {
    const onHover = vi.fn<NonNullable<GlobeControlsOptions['onHover']>>();
    const { controls, pointer } = await renderControls({ onHover });

    controls.flyTo(FLY_TARGET);
    expect(onHover).toHaveBeenLastCalledWith(null, IMMEDIATE_HOVER);
    controls.advance(0.3, 0);
    pointer('pointermove', 300, { y: 200 });
    expect(onHover).toHaveBeenLastCalledWith(null, IMMEDIATE_HOVER);
    controls.advance(1, 0);
    pointer('pointermove', 300, { y: 200 });
    expect(onHover.mock.lastCall?.[0]).not.toBeNull();
  });

  it('cancels the hover at once on wheel', async () => {
    const onHover = vi.fn<NonNullable<GlobeControlsOptions['onHover']>>();
    const { pointer, wheel } = await renderControls({ onHover });

    pointer('pointermove', 300, { y: 200 });
    wheel(-200);
    expect(onHover).toHaveBeenLastCalledWith(null, IMMEDIATE_HOVER);
  });

  it('cancels the hover at once while the globe coasts after a flick', async () => {
    const onHover = vi.fn<NonNullable<GlobeControlsOptions['onHover']>>();
    const { pointer, flick, step } = await renderControls({ onHover });

    flick();
    pointer('pointermove', 300, { y: 200 });
    expect(onHover).toHaveBeenLastCalledWith(null, IMMEDIATE_HOVER);
    step(120);
    pointer('pointermove', 300, { y: 200 });
    expect(onHover.mock.lastCall?.[0]).not.toBeNull();
  });

  it('settles once after a drag released without inertia', async () => {
    const onSettle = vi.fn<NonNullable<GlobeControlsOptions['onSettle']>>();
    const { controls, pointer, step } = await renderControls({ onSettle });

    pointer('pointerdown', 100);
    pointer('pointermove', 200, { time: 0 });
    expect(onSettle).not.toHaveBeenCalled();
    pointer('pointerup', 200, { time: 80 });
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenCalledWith(controls.viewRef.current);
    step(60);
    expect(onSettle).toHaveBeenCalledTimes(1);
  });

  it('settles once when the inertia stops and not while it coasts', async () => {
    const onSettle = vi.fn<NonNullable<GlobeControlsOptions['onSettle']>>();
    const { controls, flick, step } = await renderControls({ onSettle });

    flick();
    step(10);
    expect(onSettle).not.toHaveBeenCalled();
    step(50);
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenCalledWith(controls.viewRef.current);
    step(60);
    expect(onSettle).toHaveBeenCalledTimes(1);
  });

  it('settles once at the end of a fly', async () => {
    const onSettle = vi.fn<NonNullable<GlobeControlsOptions['onSettle']>>();
    const { controls, step } = await renderControls({ onSettle });

    controls.flyTo(FLY_TARGET);
    controls.advance(0.45, 0);
    expect(onSettle).not.toHaveBeenCalled();
    controls.advance(0.5, 0);
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenCalledWith(FLY_TARGET);
    step(60);
    expect(onSettle).toHaveBeenCalledTimes(1);
  });

  it('settles at once when a fly jumps under reduced motion', async () => {
    stubReducedMotion(true);
    const onSettle = vi.fn<NonNullable<GlobeControlsOptions['onSettle']>>();
    const { controls } = await renderControls({ onSettle });

    controls.flyTo(FLY_TARGET);
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenCalledWith(FLY_TARGET);
  });

  it('settles after a drag released under reduced motion', async () => {
    stubReducedMotion(true);
    const onSettle = vi.fn<NonNullable<GlobeControlsOptions['onSettle']>>();
    const { controls, flick } = await renderControls({ onSettle });

    flick();
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenCalledWith(controls.viewRef.current);
  });

  it('settles on every wheel event', async () => {
    const onSettle = vi.fn<NonNullable<GlobeControlsOptions['onSettle']>>();
    const { controls, wheel } = await renderControls({ onSettle });

    wheel(-200);
    expect(onSettle).toHaveBeenLastCalledWith(controls.viewRef.current);
    wheel(-200);
    expect(onSettle).toHaveBeenCalledTimes(2);
    expect(onSettle).toHaveBeenLastCalledWith(controls.viewRef.current);
  });

  it('settles when a moved drag is cancelled', async () => {
    const onSettle = vi.fn<NonNullable<GlobeControlsOptions['onSettle']>>();
    const { controls, pointer } = await renderControls({ onSettle });

    pointer('pointerdown', 100);
    pointer('pointercancel', 100);
    expect(onSettle).not.toHaveBeenCalled();
    pointer('pointerdown', 100);
    pointer('pointermove', 200);
    pointer('pointercancel', 200);
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenCalledWith(controls.viewRef.current);
  });

  it('settles when a pinch ends', async () => {
    const onSettle = vi.fn<NonNullable<GlobeControlsOptions['onSettle']>>();
    const { controls, pointer } = await renderControls({ onSettle });

    pointer('pointerdown', 100, { id: 1 });
    pointer('pointerdown', 200, { id: 2 });
    pointer('pointermove', 300, { id: 2 });
    expect(onSettle).not.toHaveBeenCalled();
    pointer('pointerup', 300, { id: 2 });
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle.mock.lastCall?.[0].zoom).toBeCloseTo(2, 6);
    pointer('pointerup', 100, { id: 1 });
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(controls.viewRef.current.zoom).toBeCloseTo(2, 6);
  });

  it('does not settle when a pinch ends without changing the zoom', async () => {
    const onSettle = vi.fn<NonNullable<GlobeControlsOptions['onSettle']>>();
    const { controls, pointer } = await renderControls({ onSettle });

    pointer('pointerdown', 100, { id: 1 });
    pointer('pointerdown', 200, { id: 2 });
    pointer('pointermove', 200, { id: 2 });
    pointer('pointerup', 200, { id: 2 });
    pointer('pointerup', 100, { id: 1 });
    expect(onSettle).not.toHaveBeenCalled();
    expect(controls.viewRef.current.zoom).toBe(INITIAL_VIEW.zoom);
  });

  it('does not settle when a pinch-in is clamped at the minimum zoom', async () => {
    const onSettle = vi.fn<NonNullable<GlobeControlsOptions['onSettle']>>();
    const { controls, pointer } = await renderControls({ onSettle });

    pointer('pointerdown', 100, { id: 1 });
    pointer('pointerdown', 300, { id: 2 });
    pointer('pointermove', 150, { id: 2 });
    pointer('pointerup', 150, { id: 2 });
    pointer('pointerup', 100, { id: 1 });
    expect(controls.viewRef.current.zoom).toBe(ZOOM_RANGE[0]);
    expect(onSettle).not.toHaveBeenCalled();
  });

  it('settles when a moved drag turns into a pinch that ends', async () => {
    const onSettle = vi.fn<NonNullable<GlobeControlsOptions['onSettle']>>();
    const { controls, pointer } = await renderControls({ onSettle });

    pointer('pointerdown', 100, { id: 1 });
    pointer('pointermove', 200, { id: 1 });
    pointer('pointerdown', 300, { id: 2 });
    pointer('pointerup', 300, { id: 2 });
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenCalledWith(controls.viewRef.current);
    pointer('pointerup', 200, { id: 1 });
    expect(onSettle).toHaveBeenCalledTimes(1);
  });

  it('settles with the current view when a press interrupts inertia or a fly', async () => {
    const onSettle = vi.fn<NonNullable<GlobeControlsOptions['onSettle']>>();
    const { controls, pointer, flick, step } = await renderControls({ onSettle });

    flick();
    step(5);
    const coasting = controls.viewRef.current;
    pointer('pointerdown', 100);
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenLastCalledWith(coasting);
    pointer('pointerup', 100);
    controls.flyTo(FLY_TARGET);
    controls.advance(0.3, 0);
    const flying = controls.viewRef.current;
    pointer('pointerdown', 100);
    expect(onSettle).toHaveBeenCalledTimes(2);
    expect(onSettle).toHaveBeenLastCalledWith(flying);
    pointer('pointerup', 100);
    step(60);
    expect(onSettle).toHaveBeenCalledTimes(2);
  });

  it('never settles while drifting', async () => {
    const onSettle = vi.fn<NonNullable<GlobeControlsOptions['onSettle']>>();
    const { step } = await renderControls({ onSettle });

    expect(step(600).lon).not.toBe(INITIAL_VIEW.lon);
    expect(onSettle).not.toHaveBeenCalled();
  });

  it('frames a target with a fly that never settles and drifts after it lands', async () => {
    const onSettle = vi.fn<NonNullable<GlobeControlsOptions['onSettle']>>();
    const { controls, step } = await renderControls({ onSettle });
    const from = controls.viewRef.current;

    controls.frameTo(FLY_TARGET);
    expect(controls.advance(0.45, 0)).toEqual(getFlyView(from, FLY_TARGET, 0.5));
    expect(controls.advance(0.5, 0)).toEqual(FLY_TARGET);
    expect(step(1).lon).not.toBe(FLY_TARGET.lon);
    step(60);
    expect(onSettle).not.toHaveBeenCalled();
  });

  it('jumps to the frame target under reduced motion without settling', async () => {
    stubReducedMotion(true);
    const onSettle = vi.fn<NonNullable<GlobeControlsOptions['onSettle']>>();
    const { controls, step } = await renderControls({ onSettle });

    controls.frameTo(FLY_TARGET);
    expect(step(1)).toEqual(FLY_TARGET);
    expect(onSettle).not.toHaveBeenCalled();
  });

  it('ignores a frame request after a drag or while a pointer is down', async () => {
    const { controls, pointer } = await renderControls();

    pointer('pointerdown', 100);
    controls.frameTo(FLY_TARGET);
    pointer('pointerup', 100);
    expect(controls.advance(1, 0)).not.toEqual(FLY_TARGET);
    pointer('pointerdown', 100);
    pointer('pointermove', 200, { time: 0 });
    pointer('pointerup', 200, { time: 80 });
    const dragged = controls.viewRef.current;
    controls.frameTo(FLY_TARGET);
    expect(controls.advance(1, 0)).toEqual(dragged);
  });

  it('stops for good when a press interrupts the framing fly', async () => {
    const onSettle = vi.fn<NonNullable<GlobeControlsOptions['onSettle']>>();
    const { controls, pointer, step } = await renderControls({ onSettle });

    controls.frameTo(FLY_TARGET);
    controls.advance(0.3, 0);
    const interrupted = controls.viewRef.current;
    pointer('pointerdown', 100);
    pointer('pointerup', 100);
    expect(step(60)).toEqual(interrupted);
    controls.frameTo(FLY_TARGET);
    expect(controls.advance(1, 0)).toEqual(interrupted);
    expect(onSettle).not.toHaveBeenCalled();
  });

  it('starts at the initial view, holds it and ignores a frame request', async () => {
    const initialView: GlobeView = { lon: -1.1, lat: 0.3, zoom: 2.5 };
    const { controls, step } = await renderControls({ initialView });

    expect(controls.viewRef.current).toEqual(initialView);
    expect(step(60)).toEqual(initialView);
    controls.frameTo(FLY_TARGET);
    expect(controls.advance(1, 0)).toEqual(initialView);
  });
});
