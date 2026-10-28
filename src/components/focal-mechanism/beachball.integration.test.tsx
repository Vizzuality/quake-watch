import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';

import { Beachball } from './beachball';

function getRelativeLuminance(color: string): number {
  const [r, g, b] = color
    .match(/\d+(\.\d+)?/g)!
    .slice(0, 3)
    .map((channel) => {
      const value = Number(channel) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('Beachball', () => {
  afterEach(() => {
    delete document.documentElement.dataset.resolvedTheme;
  });

  it.each(['light', 'dark'])(
    'draws compression darker than dilatation in the %s theme',
    async (theme) => {
      document.documentElement.dataset.resolvedTheme = theme;
      const screen = await render(
        <Beachball
          plane={{ strikeDeg: 30, dipDeg: 60, rakeDeg: 90 }}
          size={96}
          title="Beachball"
        />,
      );
      const base = screen.container.querySelector('circle')!;
      const compression = screen.container.querySelector('path')!;

      expect(getRelativeLuminance(getComputedStyle(compression).fill)).toBeLessThan(
        getRelativeLuminance(getComputedStyle(base).fill),
      );
    },
  );
});
