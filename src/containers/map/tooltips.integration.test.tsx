import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';

import { getIntensity } from '@/lib/earthquakes/intensity';
import type { Earthquake } from '@/lib/earthquakes/types';

import { EpicenterTooltipContent } from './epicenter-tooltip';
import { RingTooltipContent } from './ring-tooltip';

const EARTHQUAKE: Earthquake = {
  id: 'a',
  source: 'usgs',
  magnitude: 5.24,
  magnitudeType: 'mww',
  place: '1 km W of Alhendín, Spain',
  time: Date.UTC(2026, 7, 14, 12, 0),
  depthKm: 9.8,
  latitude: 37.13,
  longitude: -3.65,
  url: '',
};

const HIT = {
  earthquake: EARTHQUAKE,
  distanceKm: 120,
  intensity: getIntensity({ magnitude: 5.24, depthKm: 9.8, distanceKm: 120 }),
  secondsSinceRuptureStart: 30.1,
};

describe('RingTooltipContent', () => {
  it('shows the estimated Intensity, Magnitude, distance from the Epicenter and seconds since the rupture start', async () => {
    const screen = await render(<RingTooltipContent hit={HIT} moreCount={0} locale="en" />);
    await expect
      .element(screen.getByText(/At this point · estimated Intensity [IVX]+ · /))
      .toBeVisible();
    await expect.element(screen.getByText('Magnitude 5.2')).toBeVisible();
    await expect.element(screen.getByText('120 km from the Epicenter')).toBeVisible();
    await expect.element(screen.getByText('+30 s since the rupture start')).toBeVisible();
    await expect.element(screen.getByText(/more/)).not.toBeInTheDocument();
  });

  it('adds how many more rings are under the cursor', async () => {
    const screen = await render(<RingTooltipContent hit={HIT} moreCount={2} locale="en" />);
    await expect.element(screen.getByText('and 2 more')).toBeVisible();
  });

  it('speaks Spanish', async () => {
    const screen = await render(<RingTooltipContent hit={HIT} moreCount={1} locale="es" />);
    await expect
      .element(screen.getByText(/En este punto · intensidad estimada [IVX]+ · /))
      .toBeVisible();
    await expect.element(screen.getByText('Magnitud 5,2')).toBeVisible();
    await expect.element(screen.getByText('A 120 km del epicentro')).toBeVisible();
    await expect.element(screen.getByText('+30 s desde el inicio de la ruptura')).toBeVisible();
    await expect.element(screen.getByText('y 1 más')).toBeVisible();
  });
});

describe('EpicenterTooltipContent', () => {
  it('shows place, Magnitude with type, local date-time, Depth and the Place of interest distance', async () => {
    const screen = await render(
      <EpicenterTooltipContent
        earthquake={EARTHQUAKE}
        placeOfInterest={{ label: 'Madrid', distanceKm: 358 }}
        locale="en"
      />,
    );
    await expect.element(screen.getByText('1 km W of Alhendín, Spain')).toBeVisible();
    await expect.element(screen.getByText('Magnitude 5.2 (mww)')).toBeVisible();
    await expect.element(screen.getByText(/Aug 14, 2026/)).toBeVisible();
    await expect.element(screen.getByText('Depth 9.8 km')).toBeVisible();
    await expect.element(screen.getByText('358 km from Madrid')).toBeVisible();
  });

  it('handles a missing place, magnitude type and Place of interest', async () => {
    const screen = await render(
      <EpicenterTooltipContent
        earthquake={{ ...EARTHQUAKE, place: null, magnitudeType: null }}
        placeOfInterest={null}
        locale="en"
      />,
    );
    await expect.element(screen.getByText('Unknown location')).toBeVisible();
    await expect.element(screen.getByText('Magnitude 5.2')).toBeVisible();
    await expect.element(screen.getByText(/from/)).not.toBeInTheDocument();
  });

  it('speaks Spanish', async () => {
    const screen = await render(
      <EpicenterTooltipContent
        earthquake={EARTHQUAKE}
        placeOfInterest={{ label: 'Madrid', distanceKm: 358 }}
        locale="es"
      />,
    );
    await expect.element(screen.getByText('Magnitud 5,2 (mww)')).toBeVisible();
    await expect.element(screen.getByText('Profundidad 9,8 km')).toBeVisible();
    await expect.element(screen.getByText('A 358 km de Madrid')).toBeVisible();
  });
});
