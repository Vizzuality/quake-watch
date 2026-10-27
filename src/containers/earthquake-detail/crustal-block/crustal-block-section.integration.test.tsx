import { createElement } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CrustCell } from '@/lib/crust/types';
import { renderWithRouter } from '@/test/render-with-router';
import { stubFetch } from '@/test/stub-fetch';

import type { CrustalBlockProps } from './use-crustal-block';

const mocks = vi.hoisted(() => ({
  getCrustCells: vi.fn<(args: { data: unknown }) => Promise<CrustCell[]>>(),
  isWebGL2Available: vi.fn<() => boolean>(),
  sceneFailure: { current: null as Error | null },
  sceneRenders: { current: 0 },
}));

vi.mock('@/server/crust', () => ({ getCrustCells: mocks.getCrustCells }));
vi.mock('./webgl-support', () => ({ isWebGL2Available: mocks.isWebGL2Available }));
vi.mock('./crustal-block-scene', async () => {
  const actual =
    await vi.importActual<typeof import('./crustal-block-scene')>('./crustal-block-scene');
  return {
    default: (props: CrustalBlockProps) => {
      mocks.sceneRenders.current += 1;
      if (mocks.sceneFailure.current) throw mocks.sceneFailure.current;
      return createElement(actual.default, props);
    },
  };
});

import { CrustalBlockSection } from './crustal-block-section';

const MADRID_CELL: CrustCell = {
  latitude: 40.5,
  longitude: -3.5,
  boundaryElevationsKm: [0.8, 0.8, 0.8, -0.2, -2.0, -2.0, -11.83, -21.65, -31.77],
};

const MADRID = { latitude: 40.4, longitude: -3.7, depthKm: 10 };

const SCENE_LOAD = { timeout: 5_000 };

function canCreateWebGL2Context(): boolean {
  return document.createElement('canvas').getContext('webgl2') !== null;
}

function stubTerrariumTiles() {
  return stubFetch([
    {
      match: (url) => url.hostname === 's3.amazonaws.com',
      respond: () => new Response(null, { status: 404 }),
    },
  ]);
}

function holdAnimationFrames() {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  return function releaseFrames() {
    for (let callback = frames.shift(); callback; callback = frames.shift()) {
      callback(performance.now());
    }
  };
}

async function renderSection(props: CrustalBlockProps = MADRID) {
  return renderWithRouter(() => <CrustalBlockSection {...props} />);
}

describe('CrustalBlockSection', () => {
  // A cold Vite transform of three/R3F can outlast any per-assertion wait, so load it once up front.
  beforeAll(() => import('./crustal-block-scene'), 60_000);

  beforeEach(() => {
    mocks.getCrustCells.mockReset();
    mocks.getCrustCells.mockResolvedValue([MADRID_CELL]);
    mocks.isWebGL2Available.mockReset();
    mocks.isWebGL2Available.mockReturnValue(false);
    mocks.sceneFailure.current = null;
    mocks.sceneRenders.current = 0;
  });

  afterEach(() => vi.unstubAllGlobals());

  it('holds the 3D scene behind its skeleton until the first frame', async () => {
    const releaseFrames = holdAnimationFrames();
    mocks.isWebGL2Available.mockReturnValue(true);
    mocks.sceneFailure.current = new Error('Error creating WebGL context.');
    const { screen } = await renderSection();
    await expect.element(screen.getByText('Layers under the Epicenter')).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mocks.sceneRenders.current).toBe(0);
    const skeletonHeights = [...screen.container.querySelectorAll('span[aria-hidden="true"]')].map(
      (skeleton) => skeleton.getBoundingClientRect().height,
    );
    expect(skeletonHeights).toContain(500);

    releaseFrames();
    await expect.element(screen.getByText(/3D view isn't available/), SCENE_LOAD).toBeVisible();
  });

  it('renders only the layer list without WebGL', async () => {
    const { screen } = await renderSection();
    await expect.element(screen.getByText('Layers under the Epicenter')).toBeVisible();
    await expect.element(screen.getByText(/3D view isn't available/)).toBeVisible();
    await expect.element(screen.getByText('2 km deep to 11.8 km deep')).toBeVisible();
    await expect.element(screen.getByText('31.8 km deep', { exact: true })).toBeVisible();
    await expect.element(screen.getByText('10 km deep', { exact: true })).toBeVisible();
    expect(screen.container.querySelector('canvas')).toBeNull();
    expect(mocks.getCrustCells).toHaveBeenCalledWith({
      data: { latitude: 40.4, longitude: -3.7, radiusCells: 1 },
    });
  });

  it('orders the rupture start among the layers by depth', async () => {
    const { screen } = await renderSection();
    await expect.element(screen.getByText('Rupture start', { exact: true })).toBeVisible();
    const labels = [...screen.container.querySelectorAll('dt')].map((term) => term.textContent);
    expect(labels).toEqual([
      'Upper sediments',
      'Middle sediments',
      'Upper crust',
      'Rupture start',
      'Middle crust',
      'Lower crust',
      'Moho',
      'Upper mantle',
    ]);
  });

  it('explains a layer in plain words on demand', async () => {
    const { screen } = await renderSection();
    const toggle = screen.getByRole('button', { name: 'Explain Moho' });
    await toggle.click();
    await expect
      .element(screen.getByText(/boundary between the crust and the mantle/))
      .toBeVisible();
  });

  it('keeps two decimals for layers thinner than a kilometer', async () => {
    mocks.getCrustCells.mockResolvedValue([
      {
        latitude: 40.5,
        longitude: -3.5,
        boundaryElevationsKm: [0.8, 0.8, 0.8, -0.15, -0.24, -0.24, -11.83, -21.65, -31.77],
      },
    ]);
    const { screen } = await renderSection();
    await expect.element(screen.getByText('0.15 km deep to 0.24 km deep')).toBeVisible();
  });

  it('lists the deep mantle boundaries inside a deep block', async () => {
    mocks.getCrustCells.mockResolvedValue([
      {
        latitude: -20.5,
        longitude: -178.5,
        boundaryElevationsKm: [0, -4.5, -4.5, -4.8, -5, -5, -6.5, -8.5, -11],
      },
    ]);
    const { screen } = await renderSection({ latitude: -20.5, longitude: -178.5, depthKm: 600 });
    await expect.element(screen.getByText('From 400 km deep')).toBeVisible();
    await expect.element(screen.getByText('From 670 km deep')).toBeVisible();
    await expect.element(screen.getByText('Transition zone').first()).toBeVisible();
  });

  it('credits CRUST1.0 and the terrain tiles in the legend', async () => {
    const { screen } = await renderSection();
    await expect
      .element(
        screen.getByRole('link', {
          name: /CRUST1\.0 — Laske, G\., Masters, G\., Ma, Z\. & Pasyanos, M\. \(2013\)/,
        }),
      )
      .toHaveAttribute('href', 'https://igppweb.ucsd.edu/~gabi/crust1.html');
    await expect
      .element(screen.getByRole('link', { name: /Terrain Tiles/ }))
      .toHaveAttribute('href', 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md');
    await expect
      .element(screen.getByText('Relief exaggerated ×10 · layers to scale'))
      .toBeVisible();
  });

  it('falls back to the list when the 3D scene fails to start', async () => {
    mocks.isWebGL2Available.mockReturnValue(true);
    mocks.sceneFailure.current = new Error('Error creating WebGL context.');
    const { screen } = await renderSection();
    await expect.element(screen.getByText(/3D view isn't available/), SCENE_LOAD).toBeVisible();
    await expect.element(screen.getByText('Layers under the Epicenter')).toBeVisible();
    expect(screen.container.querySelector('canvas')).toBeNull();
  });

  it('offers an inline retry when the 3D view fails to download', async () => {
    mocks.isWebGL2Available.mockReturnValue(true);
    mocks.sceneFailure.current = new TypeError(
      'Failed to fetch dynamically imported module: /crustal-block-scene.tsx',
    );
    const { screen } = await renderSection();
    await expect
      .element(screen.getByRole('alert'), SCENE_LOAD)
      .toMatchTextContent("Couldn't load the 3D view.");
    await expect.element(screen.getByText('Layers under the Epicenter')).toBeVisible();
    mocks.sceneFailure.current = new Error('Error creating WebGL context.');
    await screen.getByRole('button', { name: 'Retry' }).click();
    await expect.element(screen.getByText(/3D view isn't available/), SCENE_LOAD).toBeVisible();
    expect(screen.getByRole('alert').elements()).toHaveLength(0);
  });

  it('shows a persistent inline error when the layers fail to load', async () => {
    mocks.getCrustCells.mockRejectedValue(new Error('boom'));
    const { screen } = await renderSection();
    await expect
      .element(screen.getByRole('alert'))
      .toMatchTextContent("Couldn't load the layers under the Epicenter.");
    mocks.getCrustCells.mockResolvedValue([MADRID_CELL]);
    await screen.getByRole('button', { name: 'Retry' }).click();
    await expect.element(screen.getByText('Layers under the Epicenter')).toBeVisible();
  });

  it.runIf(canCreateWebGL2Context())('paints the 3D block when WebGL is available', async () => {
    stubTerrariumTiles();
    mocks.isWebGL2Available.mockReturnValue(true);
    const { screen } = await renderSection();
    await expect.poll(() => screen.container.querySelector('canvas'), SCENE_LOAD).not.toBeNull();
    await expect.element(screen.getByText('Rupture start · 10 km'), SCENE_LOAD).toBeInTheDocument();
    const canvas = screen.container.querySelector('canvas')!;
    expect(getComputedStyle(canvas).touchAction).not.toBe('none');
    expect(getComputedStyle(canvas.parentElement!.parentElement!).touchAction).not.toBe('none');
  });
});
