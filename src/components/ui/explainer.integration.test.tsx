import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import { Datum, DatumList, SectionExplainer } from './explainer';

describe('SectionExplainer', () => {
  it.each(['{Enter}', ' '])('toggles with keyboard key %j', async (key) => {
    const screen = await render(<SectionExplainer>Plain words.</SectionExplainer>);
    const summary = screen.getByText('What does this mean?');
    const details = screen.container.querySelector('details')!;
    (summary.element() as HTMLElement).focus();
    expect(details.open).toBe(false);
    await userEvent.keyboard(key);
    expect(details.open).toBe(true);
    await expect.element(screen.getByText('Plain words.')).toBeVisible();
    await userEvent.keyboard(key);
    expect(details.open).toBe(false);
  });
});

describe('Datum', () => {
  it.each(['{Enter}', ' '])('reveals the explanation with keyboard key %j', async (key) => {
    const screen = await render(
      <DatumList>
        <Datum label="Azimuthal gap" value="42°" explanation="Biggest station-free gap." />
      </DatumList>,
    );
    const toggle = screen.getByRole('button', { name: 'Explain Azimuthal gap' });
    await expect.element(screen.getByText('Biggest station-free gap.')).not.toBeVisible();
    (toggle.element() as HTMLElement).focus();
    await userEvent.keyboard(key);
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect.element(screen.getByText('Biggest station-free gap.')).toBeVisible();
    await userEvent.keyboard(key);
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders no toggle without an explanation', async () => {
    const screen = await render(
      <DatumList>
        <Datum label="Depth" value="10 km" />
      </DatumList>,
    );
    expect(screen.getByRole('button').elements()).toHaveLength(0);
  });
});
