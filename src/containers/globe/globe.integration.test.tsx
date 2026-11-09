import { createRef, useImperativeHandle, useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import Globe from '@/containers/globe/globe';
import {
  type GlobeControls,
  MAX_RELEASE_SPEED,
  useGlobeControls,
} from '@/containers/globe/use-globe-controls';
import { getGlobeFrame } from '@/lib/globe/frame';
import { INITIAL_VIEW } from '@/lib/globe/motion';
import { overwriteGetLocale } from '@/paraglide/runtime';

const WIDTH = 1280;
const HEIGHT = 800;
const { cx: CX, cy: CY, radius: RADIUS } = getGlobeFrame(WIDTH, HEIGHT);
const FRAME = 1 / 60;

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
  const original = window.matchMedia.bind(window);
  vi.stubGlobal('matchMedia', (query: string) =>
    Object.defineProperty(original(query), 'matches', { value: matches }),
  );
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

async function renderGlobe() {
  return render(
    <div style={{ position: 'relative', width: WIDTH, height: HEIGHT }}>
      <Globe />
    </div>,
  );
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
    const screen = await renderGlobe();

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

  it('leaves the canvas transparent around the globe and paints the disc', async () => {
    stubPreservedDrawingBuffer();
    const screen = await renderGlobe();

    await vi.waitFor(() => expect(screen.container.querySelector('canvas')).not.toBeNull());
    await waitFrames(10);
    const canvas = screen.container.querySelector('canvas') as HTMLCanvasElement;
    expect(getPixelAlpha(canvas, 1, 1)).toBe(0);
    expect(getPixelAlpha(canvas, CX, CY)).toBeGreaterThan(0);
  });

  it('keeps the shell and says so inline when WebGL is missing', async () => {
    stubWebGL(0);
    const screen = await renderGlobe();

    await expect
      .element(screen.getByRole('status'))
      .toHaveTextContent("Your browser can't draw the globe.");
    expect(screen.container.querySelector('canvas')).toBeNull();
  });

  it('falls back to the same line when the renderer cannot start', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubWebGL(1);
    const screen = await renderGlobe();

    await expect
      .element(screen.getByRole('status'))
      .toHaveTextContent("Your browser can't draw the globe.");
  });

  it('speaks Spanish without WebGL', async () => {
    overwriteGetLocale(() => 'es');
    stubWebGL(0);
    const screen = await renderGlobe();

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
