import '@/styles.css';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { cdp, userEvent } from 'vitest/browser';

import { getIsMapCovered } from '@/lib/layout/sheet-cover-store';
import { setViewport } from '@/test/set-viewport';

import { BottomSheet } from './bottom-sheet';

const COLLAPSED_TOP = 548;
const EXPANDED_TOP = 128;
const HANDLE_LABELS = { open: 'Open the sheet', close: 'Close the sheet' };

function Harness() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <main className="relative h-dvh">
      <BottomSheet
        label="Sheet"
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        collapsedTop={COLLAPSED_TOP}
        expandedTop={EXPANDED_TOP}
        handleLabels={HANDLE_LABELS}
      >
        <p>Sheet content</p>
      </BottomSheet>
      <div data-testid="above-sheet" className="absolute inset-x-0 top-[460px] h-5" />
    </main>
  );
}

async function renderSheet() {
  const screen = await render(<Harness />);
  const sheet = screen.getByRole('region', { name: 'Sheet' });
  await expect.element(sheet).toBeVisible();
  return {
    screen,
    sheet: sheet.element() as HTMLElement,
    handle: screen.getByRole('button', { name: HANDLE_LABELS.open }),
  };
}

function dragHandle(handle: Element, fromY: number, steps: { y: number; time: number }[]) {
  const x = handle.getBoundingClientRect().left + 40;
  function pointer(type: string, y: number, time: number) {
    const event = new PointerEvent(type, {
      pointerId: 1,
      pointerType: 'touch',
      button: 0,
      clientX: x,
      clientY: y,
      bubbles: true,
    });
    Object.defineProperty(event, 'timeStamp', { value: time });
    handle.dispatchEvent(event);
  }
  pointer('pointerdown', fromY, 0);
  for (const { y, time } of steps) pointer('pointermove', y, time);
  const last = steps.at(-1) ?? { y: fromY, time: 0 };
  pointer('pointerup', last.y, last.time);
}

async function setReducedMotion(isReduced: boolean) {
  const features = isReduced ? [{ name: 'prefers-reduced-motion', value: 'reduce' }] : [];
  await cdp().send('Emulation.setEmulatedMedia', { features });
}

function getTop(element: HTMLElement): number {
  return element.getBoundingClientRect().top;
}

describe('BottomSheet', () => {
  beforeEach(async () => {
    await setViewport(390, 844);
    await setReducedMotion(true);
  });

  afterEach(async () => {
    await setReducedMotion(false);
    await setViewport(1280, 800);
  });

  it('draws the sheet surface and a 38×4 handle inside a 44 px hit row clear of the corners', async () => {
    const { sheet, handle } = await renderSheet();
    const style = getComputedStyle(sheet);
    const handleRect = handle.element().getBoundingClientRect();
    const bar = handle.element().querySelector('span') as HTMLElement;

    expect(getTop(sheet)).toBe(COLLAPSED_TOP);
    expect(sheet.getBoundingClientRect().bottom).toBe(844);
    expect(style.borderTopLeftRadius).toBe('18px');
    expect(style.borderTopRightRadius).toBe('18px');
    expect(style.borderTopWidth).toBe('1px');
    expect(style.borderTopColor).toBe('rgba(185, 182, 224, 0.2)');
    expect(style.backgroundColor).toBe('rgba(23, 26, 51, 0.62)');
    expect(style.backdropFilter).toBe('blur(24px)');
    expect(handleRect.height).toBeGreaterThanOrEqual(44);
    expect(handleRect.left).toBe(44);
    expect(handleRect.right).toBe(346);
    expect(bar.getBoundingClientRect().width).toBe(38);
    expect(bar.getBoundingClientRect().height).toBe(4);
    expect(getComputedStyle(bar).backgroundColor).toBe('rgba(230, 228, 245, 0.35)');
    expect(getComputedStyle(sheet.lastElementChild as HTMLElement).overflowY).toBe('auto');
  });

  it('toggles between the two tops when the handle is tapped', async () => {
    const { screen, sheet, handle } = await renderSheet();

    await expect.element(handle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(handle);

    const close = screen.getByRole('button', { name: HANDLE_LABELS.close });
    await expect.element(close).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => getTop(sheet)).toBe(EXPANDED_TOP);

    await userEvent.click(close);
    await expect.element(handle).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(() => getTop(sheet)).toBe(COLLAPSED_TOP);
  });

  it('opens when the handle is dragged up past 40 px and closes when dragged back down', async () => {
    const { screen, sheet, handle } = await renderSheet();

    dragHandle(handle.element(), 560, [
      { y: 540, time: 200 },
      { y: 510, time: 800 },
    ]);
    const close = screen.getByRole('button', { name: HANDLE_LABELS.close });
    await expect.element(close).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => getTop(sheet)).toBe(EXPANDED_TOP);

    dragHandle(close.element(), 140, [{ y: 200, time: 900 }]);
    await expect.element(handle).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(() => getTop(sheet)).toBe(COLLAPSED_TOP);
  });

  it('stays open after a real mouse drag up and the click that follows it', async () => {
    const { screen, sheet, handle } = await renderSheet();

    await userEvent.dragAndDrop(handle, screen.getByTestId('above-sheet'));

    const close = screen.getByRole('button', { name: HANDLE_LABELS.close });
    await expect.element(close).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => getTop(sheet)).toBe(EXPANDED_TOP);
  });

  it('toggles from the keyboard with Enter and Space, even right after a drag', async () => {
    const { screen, handle } = await renderSheet();
    dragHandle(handle.element(), 560, [{ y: 540, time: 600 }]);
    await expect.element(handle).toHaveAttribute('aria-expanded', 'false');

    (handle.element() as HTMLElement).focus();
    await userEvent.keyboard('{Enter}');
    const close = screen.getByRole('button', { name: HANDLE_LABELS.close });
    await expect.element(close).toHaveAttribute('aria-expanded', 'true');

    await userEvent.keyboard(' ');
    await expect.element(handle).toHaveAttribute('aria-expanded', 'false');
  });

  it('follows the pointer during a drag and snaps back after a short slow drag', async () => {
    const { sheet, handle } = await renderSheet();
    const element = handle.element();
    const x = element.getBoundingClientRect().left + 40;
    function pointer(type: string, y: number, time: number) {
      const event = new PointerEvent(type, {
        pointerId: 1,
        button: 0,
        clientX: x,
        clientY: y,
        bubbles: true,
      });
      Object.defineProperty(event, 'timeStamp', { value: time });
      element.dispatchEvent(event);
    }

    pointer('pointerdown', 560, 0);
    pointer('pointermove', 535, 300);
    await expect.poll(() => getTop(sheet)).toBe(COLLAPSED_TOP - 25);
    expect(getComputedStyle(sheet).transitionProperty).toBe('none');

    pointer('pointerup', 535, 600);
    await expect.element(handle).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(() => getTop(sheet)).toBe(COLLAPSED_TOP);
  });

  it('eases top over .35 s and drops the transition under reduced motion', async () => {
    await setReducedMotion(false);
    const { sheet } = await renderSheet();
    const style = getComputedStyle(sheet);

    expect(style.transitionProperty).toBe('top');
    expect(style.transitionDuration).toBe('0.35s');
    expect(style.transitionTimingFunction).toBe('cubic-bezier(0.2, 0.8, 0.2, 1)');

    await setReducedMotion(true);
    await expect.poll(() => getComputedStyle(sheet).transitionDuration).toBe('0s');
  });

  it('grows the handle hit area above the sheet so it never covers the first row of content', async () => {
    const { screen, handle } = await renderSheet();
    const content = screen.getByText('Sheet content').element();
    const contentRect = content.getBoundingClientRect();
    const handleRect = handle.element().getBoundingClientRect();
    const x = contentRect.left + contentRect.width / 2;

    expect(handleRect.height).toBeGreaterThanOrEqual(44);
    expect(handleRect.bottom).toBeLessThanOrEqual(contentRect.top);
    expect(document.elementFromPoint(x, contentRect.top + contentRect.height / 2)).toBe(content);
    expect(handle.element().contains(document.elementFromPoint(x, COLLAPSED_TOP - 10))).toBe(true);
  });

  it('dissolves into its children from 768 px', async () => {
    await setViewport(1280, 800);
    const screen = await render(<Harness />);
    const sheet = screen.container.querySelector('section') as HTMLElement;

    await expect.element(screen.getByText('Sheet content')).toBeVisible();
    expect(getComputedStyle(sheet).display).toBe('contents');
    expect(getComputedStyle(sheet.querySelector('button') as HTMLElement).display).toBe('none');
  });
  it('marks the map as covered only while it is expanded over it', async () => {
    const { screen, handle } = await renderSheet();
    expect(getIsMapCovered()).toBe(false);

    await handle.click();
    await expect.poll(getIsMapCovered).toBe(true);

    await screen.getByRole('button', { name: HANDLE_LABELS.close }).click();
    await expect.poll(getIsMapCovered).toBe(false);
  });

  it('leaves the map uncovered beside a side sheet and after unmount', async () => {
    const screen = await render(
      <BottomSheet
        label="Side sheet"
        isOpen
        onOpenChange={() => {}}
        collapsedTop={0}
        expandedTop={0}
        handleLabels={HANDLE_LABELS}
      >
        <p>Side content</p>
      </BottomSheet>,
    );
    expect(getIsMapCovered()).toBe(false);

    await screen.rerender(
      <BottomSheet
        label="Side sheet"
        isOpen
        onOpenChange={() => {}}
        collapsedTop={548}
        expandedTop={128}
        handleLabels={HANDLE_LABELS}
      >
        <p>Side content</p>
      </BottomSheet>,
    );
    await expect.poll(getIsMapCovered).toBe(true);

    await screen.unmount();
    expect(getIsMapCovered()).toBe(false);
  });
});
