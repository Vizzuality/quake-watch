import { Component, type ReactNode, lazy } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';

import { LazyDetailMap } from './lazy-detail-map';

const CHUNK_ERROR = 'Failed to fetch dynamically imported module: /assets/usgs-detail-map.js';

function LoadedMap({ earthquakeId }: { earthquakeId: string }) {
  return <p>Map for {earthquakeId}</p>;
}

function getPendingComponent() {
  return lazy<typeof LoadedMap>(() => new Promise(() => undefined));
}

function getFailingThenLoadingComponent() {
  let attempts = 0;
  return () =>
    lazy(async () => {
      attempts += 1;
      if (attempts === 1) throw new TypeError(CHUNK_ERROR);
      return { default: LoadedMap };
    });
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

function BrokenMap(): ReactNode {
  throw new Error('Map crashed');
}

class RouteBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <p>Route error</p>;
    return this.props.children;
  }
}

function getPlaceholderHeights(container: HTMLElement) {
  const placeholder = container.querySelector<HTMLElement>(
    '[data-testid="detail-map-placeholder"]',
  )!;
  const box = placeholder.firstElementChild as HTMLElement;
  return {
    box: box.getBoundingClientRect().height,
    total: placeholder.getBoundingClientRect().height,
  };
}

describe('LazyDetailMap', () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    await page.viewport(1280, 800);
  });

  it('starts loading the map chunk only after the first frame', async () => {
    const releaseFrames = holdAnimationFrames();
    const loadMap = vi.fn<() => Promise<{ default: typeof LoadedMap }>>(async () => ({
      default: LoadedMap,
    }));
    const screen = await render(
      <LazyDetailMap getComponent={() => lazy(loadMap)} earthquakeId="us1" />,
    );

    await expect.element(screen.getByTestId('detail-map-placeholder')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(loadMap).not.toHaveBeenCalled();

    releaseFrames();
    await expect.element(screen.getByText('Map for us1')).toBeVisible();
    expect(loadMap).toHaveBeenCalledOnce();
  });

  it.each([
    { width: 1280, box: 320, total: 360 },
    { width: 375, box: 256, total: 304 },
  ])('reserves the minimap box at $width px while the map loads', async ({ width, box, total }) => {
    await page.viewport(width, 800);
    const screen = await render(
      <LazyDetailMap getComponent={getPendingComponent} earthquakeId="us1" />,
    );

    await expect.element(screen.getByTestId('detail-map-placeholder')).toBeInTheDocument();
    expect(getPlaceholderHeights(screen.container)).toEqual({ box, total });
  });

  it('keeps the box and retries when the map chunk fails to load', async () => {
    const screen = await render(
      <LazyDetailMap getComponent={getFailingThenLoadingComponent()} earthquakeId="us1" />,
    );

    await expect
      .element(screen.getByRole('alert').getByText("Couldn't load the map."))
      .toBeVisible();
    expect(getPlaceholderHeights(screen.container)).toEqual({ box: 320, total: 360 });
    await screen.getByRole('button', { name: 'Retry' }).click();
    await expect.element(screen.getByText('Map for us1')).toBeVisible();
    expect(screen.getByRole('alert').elements()).toHaveLength(0);
  });

  it('lets errors other than a failed chunk reach the route', async () => {
    const screen = await render(
      <RouteBoundary>
        <LazyDetailMap
          getComponent={() => lazy(async () => ({ default: BrokenMap }))}
          earthquakeId="us1"
        />
      </RouteBoundary>,
    );

    await expect.element(screen.getByText('Route error')).toBeVisible();
  });
});
