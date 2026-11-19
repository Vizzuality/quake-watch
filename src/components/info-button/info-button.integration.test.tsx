import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import { InfoLabel } from '@/components/info-button/info-button';

const INFO = 'Earthquakes whose shaking probably reached people at the surface.';

async function renderLabel() {
  const onDocumentEscape = vi.fn<() => void>();
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !event.defaultPrevented) onDocumentEscape();
  }
  document.addEventListener('keydown', handleKeyDown);
  const screen = await render(
    <div className="p-10">
      <button type="button">Before</button>
      <InfoLabel label="Likely felt" info={INFO} className="text-label" />
    </div>,
  );
  return {
    screen,
    onDocumentEscape,
    cleanup: () => document.removeEventListener('keydown', handleKeyDown),
  };
}

describe('InfoLabel', () => {
  let cleanup = () => {};
  afterEach(() => cleanup());

  it('names the (i) after its label and describes it with the info text', async () => {
    const rendered = await renderLabel();
    cleanup = rendered.cleanup;
    const button = rendered.screen.getByRole('button', { name: 'More about Likely felt' });

    await expect.element(button).toHaveAccessibleDescription(INFO);
    await expect
      .element(rendered.screen.getByRole('tooltip', { includeHidden: true }))
      .not.toBeVisible();
  });

  it('opens on hover and on keyboard focus', async () => {
    const rendered = await renderLabel();
    cleanup = rendered.cleanup;
    const button = rendered.screen.getByRole('button', { name: 'More about Likely felt' });

    await userEvent.hover(button);
    await expect.element(rendered.screen.getByRole('tooltip')).toBeVisible();
    await userEvent.unhover(button);
    await expect
      .element(rendered.screen.getByRole('tooltip', { includeHidden: true }))
      .not.toBeVisible();

    await userEvent.click(rendered.screen.getByRole('button', { name: 'Before' }));
    await userEvent.keyboard('{Tab}');
    await expect.element(button).toHaveFocus();
    await expect.element(rendered.screen.getByRole('tooltip')).toBeVisible();
  });

  it('closes on Escape without letting the Escape close what is underneath', async () => {
    const rendered = await renderLabel();
    cleanup = rendered.cleanup;
    const button = rendered.screen.getByRole('button', { name: 'More about Likely felt' });

    await userEvent.click(rendered.screen.getByRole('button', { name: 'Before' }));
    await userEvent.keyboard('{Tab}');
    await expect.element(rendered.screen.getByRole('tooltip')).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await expect
      .element(rendered.screen.getByRole('tooltip', { includeHidden: true }))
      .not.toBeVisible();
    await expect.element(button).toHaveFocus();
    expect(rendered.onDocumentEscape).not.toHaveBeenCalled();

    await userEvent.keyboard('{Escape}');
    expect(rendered.onDocumentEscape).toHaveBeenCalledOnce();
  });

  it('turns the (i) pink when open and draws the tooltip as the QW/Info tooltip', async () => {
    const rendered = await renderLabel();
    cleanup = rendered.cleanup;
    const button = rendered.screen.getByRole('button', { name: 'More about Likely felt' });
    const icon = button.element().querySelector('svg') as SVGElement;

    expect(button.element().getBoundingClientRect().width).toBe(16);
    expect(button.element().getBoundingClientRect().height).toBe(16);
    expect(getComputedStyle(icon).color).toBe('rgb(160, 157, 193)');

    await userEvent.hover(button);
    const tooltip = rendered.screen.getByRole('tooltip').element();
    const row = button.element().parentElement as HTMLElement;
    const style = getComputedStyle(tooltip);
    const tooltipRect = tooltip.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();

    await expect.poll(() => getComputedStyle(icon).color).toBe('rgb(235, 89, 142)');
    expect(tooltipRect.width).toBe(230);
    expect(tooltipRect.left - rowRect.left).toBe(-8);
    expect(tooltipRect.top - rowRect.top).toBe(24);
    expect(style.paddingLeft).toBe('14px');
    expect(style.paddingTop).toBe('12px');
    expect(style.fontSize).toBe('12px');
    expect(style.lineHeight).toBe('16.8px');
    expect(style.backdropFilter).toBe('blur(50px)');
  });
});
