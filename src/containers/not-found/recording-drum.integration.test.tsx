import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';

import { RecordingDrum } from './recording-drum';

describe('RecordingDrum', () => {
  it('hides the drawing from assistive tech', async () => {
    const screen = await render(<RecordingDrum />);
    expect(screen.container.querySelector('[data-drum]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('scrolls the past rows and the live row with a motion-safe animation', async () => {
    const screen = await render(<RecordingDrum />);
    await expect.poll(() => screen.container.querySelectorAll('[data-scroll]').length).toBe(2);
    for (const group of screen.container.querySelectorAll('[data-scroll]')) {
      expect(group.getAttribute('class')).toBe('motion-safe:animate-drum-scroll');
    }
  });

  it('pauses and resumes the paper', async () => {
    const screen = await render(<RecordingDrum />);
    await expect.poll(() => screen.container.querySelector('button')).toBeTruthy();
    const button = screen.container.querySelector('button')!;
    expect(button.getAttribute('aria-label')).toBe('Pause the drawing');

    button.click();
    await expect.poll(() => button.getAttribute('aria-pressed')).toBe('true');
    for (const group of screen.container.querySelectorAll('[data-scroll]')) {
      expect(getComputedStyle(group).animationPlayState).toBe('paused');
    }
    button.click();
    await expect.poll(() => button.getAttribute('aria-pressed')).toBe('false');
  });
});
