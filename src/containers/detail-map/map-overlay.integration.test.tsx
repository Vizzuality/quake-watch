import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';

import { MapScaleBar } from '@/containers/detail-map/map-overlay';
import { MiniGlobe } from '@/containers/detail-map/mini-globe';
import { setViewport } from '@/test/set-viewport';

async function renderLocators() {
  const screen = await render(
    <main className="relative h-dvh overflow-hidden">
      <MiniGlobe latitude={12.09} longitude={143.99} rectRef={createRef()} />
      <MapScaleBar rootRef={createRef()} midRef={createRef()} endRef={createRef()} />
    </main>,
  );
  return {
    miniGlobe: screen.getByTestId('mini-globe').element().getBoundingClientRect(),
    scaleBar: screen.getByTestId('map-scale-bar').element().getBoundingClientRect(),
  };
}

describe('detail map locators', () => {
  afterEach(async () => {
    await setViewport(1280, 800);
  });

  it('puts the mini-globe at (352, 164) with radius 22 and the scale bar 18 px from the right above the week strip on 390 × 844', async () => {
    await setViewport(390, 844);
    const { miniGlobe, scaleBar } = await renderLocators();

    expect(miniGlobe.left + miniGlobe.width / 2).toBeCloseTo(352, 1);
    expect(miniGlobe.top + miniGlobe.height / 2).toBeCloseTo(164, 1);
    expect((miniGlobe.width * 46) / 50 / 2).toBeCloseTo(22, 1);
    expect(scaleBar.right).toBe(372);
    expect(scaleBar.top).toBe(439);
  });

  it('keeps the desktop mini-globe and scale bar where D2 puts them on 1440 × 900', async () => {
    await setViewport(1440, 900);
    const { miniGlobe, scaleBar } = await renderLocators();

    expect(miniGlobe).toMatchObject({ left: 1286, top: 498, width: 100, height: 100 });
    expect(scaleBar.right).toBe(1384);
    expect(scaleBar.bottom).toBe(662);
  });
});
