import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import Globe from '@/containers/globe/globe';
import { EARTHQUAKE_SEARCH_ROUTE } from '@/lib/earthquakes/search-schema';
import { getGlobeFrame } from '@/lib/globe/frame';
import { getFeatureCollection } from '@/test/fixtures/earthquakes';
import { stubFetch } from '@/test/stub-fetch';

const landMaskLoads = vi.hoisted(() => ({ count: 0 }));

vi.mock('@/lib/globe/land-mask', () => ({
  getLandMask: () => {
    landMaskLoads.count += 1;
    throw new Error('Failed to fetch dynamically imported module');
  },
}));

const WIDTH = 1280;
const HEIGHT = 800;

function getPaintedPixelCount(canvas: HTMLCanvasElement, x: number, y: number, size: number) {
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('globe canvas has no WebGL2 context');
  const dpr = gl.drawingBufferWidth / canvas.clientWidth;
  const pixels = new Uint8Array(size * size * 4);
  const bottom = Math.floor(gl.drawingBufferHeight - (y + size) * dpr);
  gl.readPixels(Math.floor(x * dpr), bottom, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let count = 0;
  for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) count++;
  return count;
}

async function renderGlobe() {
  vi.spyOn(Element.prototype, 'setPointerCapture').mockImplementation(() => {});
  const original = HTMLCanvasElement.prototype.getContext;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
    type: string,
    attributes?: WebGLContextAttributes,
  ) {
    return original.call(this, type, { ...attributes, preserveDrawingBuffer: true });
  } as HTMLCanvasElement['getContext']);
  stubFetch([{ match: () => true, respond: () => Response.json(getFeatureCollection([])) }]);
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
    history: createMemoryHistory({ initialEntries: ['/?lat=6.88&lon=150&zoom=1.3'] }),
  });
  await router.load();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('globe surface', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retries the land mask once, says so, and still draws the dots without land', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const screen = await renderGlobe();
    const { cx, cy } = getGlobeFrame(WIDTH, HEIGHT);

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(String(consoleError.mock.calls[0][0])).toContain('land mask');
    const canvas = screen.container.querySelector('canvas') as HTMLCanvasElement;
    await vi.waitFor(() =>
      expect(getPaintedPixelCount(canvas, cx - 8, cy - 8, 16)).toBeGreaterThan(0),
    );
    expect(landMaskLoads.count).toBe(2);
  });
});
