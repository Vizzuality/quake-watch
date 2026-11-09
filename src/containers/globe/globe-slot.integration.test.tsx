import { lazy } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { GlobeSlot } from '@/containers/globe/globe-slot';

const FailedGlobe = lazy(() =>
  Promise.reject(new Error('Failed to fetch dynamically imported module')),
);

describe('globe slot', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the shell and says so inline when the globe chunk fails to load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const screen = await render(
      <main>
        <h1>Quake Watch</h1>
        <GlobeSlot>
          <FailedGlobe />
        </GlobeSlot>
      </main>,
    );

    await expect
      .element(screen.getByRole('status'))
      .toHaveTextContent("Your browser can't draw the globe.");
    await expect.element(screen.getByRole('heading', { name: 'Quake Watch' })).toBeVisible();
  });
});
