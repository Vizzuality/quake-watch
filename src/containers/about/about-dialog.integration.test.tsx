import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import { AboutDialog } from '@/containers/about/about-dialog';
import { overwriteGetLocale } from '@/paraglide/runtime';
import { setViewport } from '@/test/set-viewport';

async function renderAbout() {
  const onDocumentEscape = vi.fn<() => void>();
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !event.defaultPrevented) onDocumentEscape();
  }
  document.addEventListener('keydown', handleKeyDown);
  const screen = await render(
    <main>
      <header className="pointer-events-none">
        <AboutDialog />
      </header>
      <button type="button">Outside</button>
    </main>,
  );
  return {
    screen,
    onDocumentEscape,
    cleanup: () => document.removeEventListener('keydown', handleKeyDown),
  };
}

describe('AboutDialog', () => {
  let cleanup = () => {};
  afterEach(async () => {
    cleanup();
    overwriteGetLocale(() => 'en');
    await setViewport(1280, 800);
  });

  it('opens a modal dialog named by its title with the data sources as links', async () => {
    const rendered = await renderAbout();
    cleanup = rendered.cleanup;
    const { screen } = rendered;

    await userEvent.click(screen.getByRole('button', { name: 'About' }));

    const dialog = screen.getByRole('dialog', { name: 'Quake Watch' });
    await expect.element(dialog).toBeVisible();
    expect(dialog.element().matches(':modal')).toBe(true);
    await expect.element(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    for (const name of [
      'USGS Earthquake Hazards Program',
      'EMSC Seismic Portal',
      'Natural Earth',
      'OpenStreetMap',
      'Photon',
      'ETOPO1 · GMTED2010',
      'CRUST1.0',
      'USGS Slab2',
    ]) {
      await expect.element(dialog.getByRole('link', { name })).toHaveAttribute('target', '_blank');
    }
    await expect.element(dialog.getByRole('link', { name: 'Vizzuality' })).toBeVisible();
  });

  it('keeps Tab inside the dialog while it is open', async () => {
    const rendered = await renderAbout();
    cleanup = rendered.cleanup;
    const { screen } = rendered;
    await userEvent.click(screen.getByRole('button', { name: 'About' }));
    const dialog = screen.getByRole('dialog').element();

    for (let step = 0; step < 8; step += 1) {
      await userEvent.keyboard('{Tab}');
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape, keeps the Escape from closing what is underneath and returns focus', async () => {
    const rendered = await renderAbout();
    cleanup = rendered.cleanup;
    const { screen } = rendered;
    const trigger = screen.getByRole('button', { name: 'About' });
    await userEvent.click(trigger);

    await userEvent.keyboard('{Escape}');

    await expect.element(screen.getByRole('dialog', { includeHidden: true })).not.toBeVisible();
    await expect.element(trigger).toHaveFocus();
    expect(rendered.onDocumentEscape).not.toHaveBeenCalled();
  });

  it('closes from the X and from a click on the scrim', async () => {
    const rendered = await renderAbout();
    cleanup = rendered.cleanup;
    const { screen } = rendered;
    const trigger = screen.getByRole('button', { name: 'About' });

    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await expect.element(screen.getByRole('dialog', { includeHidden: true })).not.toBeVisible();
    await expect.element(trigger).toHaveFocus();

    await userEvent.click(trigger);
    await userEvent.click(document.body, { position: { x: 5, y: 5 } });
    await expect.element(screen.getByRole('dialog', { includeHidden: true })).not.toBeVisible();
  });

  it('matches the D4 card geometry at 1440×900', async () => {
    await setViewport(1440, 900);
    const rendered = await renderAbout();
    cleanup = rendered.cleanup;
    const { screen } = rendered;
    await userEvent.click(screen.getByRole('button', { name: 'About' }));
    const dialog = screen.getByRole('dialog').element();
    const rect = dialog.getBoundingClientRect();
    const style = getComputedStyle(dialog);
    const close = screen.getByRole('button', { name: 'Close' }).element().getBoundingClientRect();
    const title = screen.getByRole('heading', { name: 'Quake Watch' }).element();

    expect(rect.width).toBe(620);
    expect(rect.left).toBe(410);
    expect(Math.abs(rect.top - (900 - rect.height) / 2)).toBeLessThanOrEqual(1);
    expect(style.borderTopLeftRadius).toBe('6px');
    expect(style.backgroundColor).toBe('rgba(23, 26, 51, 0.55)');
    expect(getComputedStyle(dialog, '::backdrop').backgroundColor).toBe('rgba(12, 13, 30, 0.45)');
    expect(close.width).toBe(34);
    expect(close.height).toBe(34);
    expect(close.right).toBe(rect.right - 41);
    expect(getComputedStyle(title).fontSize).toBe('30px');
  });

  it('lays out the M8 phone panel at 390×844', async () => {
    await setViewport(390, 844);
    const rendered = await renderAbout();
    cleanup = rendered.cleanup;
    const { screen } = rendered;
    await userEvent.click(screen.getByRole('button', { name: 'About' }));
    const dialog = screen.getByRole('dialog').element();
    const rect = dialog.getBoundingClientRect();
    const style = getComputedStyle(dialog);
    const close = screen.getByRole('button', { name: 'Close' }).element();
    const closeRect = close.getBoundingClientRect();

    expect(rect.width).toBe(358);
    expect(rect.left).toBe(16);
    expect(Math.abs(rect.top - 45)).toBeLessThanOrEqual(1);
    expect(style.paddingTop).toBe('0px');
    expect(style.borderTopLeftRadius).toBe('6px');
    expect(style.backdropFilter).toBe('blur(100px)');
    expect(getComputedStyle(dialog, '::backdrop').backdropFilter).toBe('blur(6px)');
    const content = dialog.firstElementChild as HTMLElement;
    expect(getComputedStyle(content).paddingTop).toBe('28px');
    expect(getComputedStyle(content).paddingLeft).toBe('22px');
    expect(closeRect.width).toBe(34);
    expect(closeRect.top - rect.top).toBe(18);
    expect(rect.right - closeRect.right).toBe(18);
    for (const [dx, dy] of [
      [-5, -5],
      [38, 38],
    ]) {
      const hit = document.elementFromPoint(closeRect.left + dx, closeRect.top + dy);
      expect(close.contains(hit)).toBe(true);
    }
  });

  it('scrolls the phone panel when its content is taller than the viewport', async () => {
    await setViewport(320, 640);
    const rendered = await renderAbout();
    cleanup = rendered.cleanup;
    await userEvent.click(rendered.screen.getByRole('button', { name: 'About' }));
    const dialog = rendered.screen.getByRole('dialog').element();

    expect(getComputedStyle(dialog).overflowY).toBe('auto');
    expect(dialog.getBoundingClientRect().bottom).toBeLessThanOrEqual(640);
    expect(dialog.scrollHeight).toBeGreaterThan(dialog.clientHeight);
  });

  it('closes on a phone from a tap on the scrim and returns focus', async () => {
    await setViewport(390, 844);
    const rendered = await renderAbout();
    cleanup = rendered.cleanup;
    const trigger = rendered.screen.getByRole('button', { name: 'About' });
    await userEvent.click(trigger);

    await userEvent.click(document.body, { position: { x: 5, y: 20 } });

    await expect
      .element(rendered.screen.getByRole('dialog', { includeHidden: true }))
      .not.toBeVisible();
    await expect.element(trigger).toHaveFocus();
  });

  it('renders in Portuguese', async () => {
    overwriteGetLocale(() => 'pt');
    const rendered = await renderAbout();
    cleanup = rendered.cleanup;
    await userEvent.click(rendered.screen.getByRole('button', { name: 'Sobre' }));
    await expect.element(rendered.screen.getByRole('button', { name: 'Fechar' })).toBeVisible();
    await expect.element(rendered.screen.getByText('Fontes de dados')).toBeVisible();
  });
});
