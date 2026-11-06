import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { createRef, useImperativeHandle } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { CAMERA_DEBOUNCE_MS, type Camera, useCameraSearch } from '@/hooks/use-camera-search';
import { type FilterSearchPatch, useFilterSearch } from '@/hooks/use-filter-search';
import { EARTHQUAKE_SEARCH_ROUTE } from '@/lib/earthquakes/search-schema';

type Setters = {
  setCamera: (camera: Camera) => void;
  setSearch: (patch: FilterSearchPatch) => Promise<void>;
};

function getValidatedSearch(router: { state: { matches: { search: unknown }[] } }) {
  return router.state.matches.at(-1)?.search as Record<string, unknown>;
}

async function renderSearchHooks(initialEntry = '/') {
  const settersRef = createRef<Setters>();

  function Probe() {
    const setCamera = useCameraSearch();
    const setSearch = useFilterSearch();
    useImperativeHandle(settersRef, () => ({ setCamera, setSearch }), [setCamera, setSearch]);
    return null;
  }

  const rootRoute = createRootRoute({ component: Outlet });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    ...EARTHQUAKE_SEARCH_ROUTE,
    component: Probe,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });
  const initialLength = router.history.length;
  await router.load();
  const screen = await render(<RouterProvider router={router} />);
  if (!settersRef.current) throw new Error('search hooks probe did not mount');
  return { router, screen, setters: settersRef.current, initialLength };
}

describe('search hooks', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes the camera once, debounced, replacing the entry with rounded wrapped values', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { router, setters } = await renderSearchHooks();
    const lengthBefore = router.history.length;
    const changes = vi.fn<() => void>();
    const unsubscribe = router.history.subscribe(changes);

    setters.setCamera({ lat: 10, lon: 10, zoom: 1 });
    vi.advanceTimersByTime(50);
    setters.setCamera({ lat: 20, lon: 20, zoom: 2 });
    vi.advanceTimersByTime(50);
    setters.setCamera({ lat: 37.1789, lon: 190, zoom: 3.456 });
    vi.advanceTimersByTime(CAMERA_DEBOUNCE_MS - 1);
    expect(changes).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    await expect.poll(() => changes.mock.calls.length).toBe(1);
    unsubscribe();

    expect(router.history.length).toBe(lengthBefore);
    await expect
      .poll(() => getValidatedSearch(router))
      .toMatchObject({ lat: 37.18, lon: -170, zoom: 3.46 });
    expect(changes).toHaveBeenCalledOnce();
  });

  it('clamps the camera to the schema bounds', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { router, setters } = await renderSearchHooks();

    setters.setCamera({ lat: 95, lon: 0, zoom: 25 });
    vi.advanceTimersByTime(CAMERA_DEBOUNCE_MS);

    await expect
      .poll(() => getValidatedSearch(router))
      .toMatchObject({ lat: 90, lon: 0, zoom: 20 });
  });

  it('pushes one entry per filter change and Back restores the previous value', async () => {
    const { router, setters } = await renderSearchHooks();
    const lengthBefore = router.history.length;

    await setters.setSearch({ minmag: 5 });
    expect(router.history.length).toBe(lengthBefore + 1);
    expect(getValidatedSearch(router)).toMatchObject({ minmag: 5 });
    expect(router.state.location.searchStr).toBe('?minmag=5');

    router.history.back();
    await expect.poll(() => getValidatedSearch(router).minmag).toBe(0);
    expect(router.state.location.searchStr).not.toContain('minmag');
  });

  it('strips a filter set back to its default from the URL', async () => {
    const { router, setters } = await renderSearchHooks('/?interval=3d');
    expect(router.state.location.searchStr).toBe('?interval=3d');

    await setters.setSearch({ interval: '7d' });
    expect(router.state.location.searchStr).toBe('');
  });

  it('normalises a default param away on load without adding an entry', async () => {
    const { router, initialLength } = await renderSearchHooks('/?interval=7d');

    await expect.poll(() => router.state.location.searchStr).toBe('');
    expect(router.history.length).toBe(initialLength);
  });

  it('pushes the selected quake', async () => {
    const { router, setters } = await renderSearchHooks();
    const lengthBefore = router.history.length;

    await setters.setSearch({ quake: 'usgs:us7000abcd' });
    expect(router.history.length).toBe(lengthBefore + 1);
    expect(getValidatedSearch(router).quake).toBe('usgs:us7000abcd');
  });
});
