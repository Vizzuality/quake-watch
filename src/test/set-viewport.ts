import { expect } from 'vitest';
import { page } from 'vitest/browser';

export async function setViewport(width: number, height: number) {
  await page.viewport(width, height);
  await expect.poll(() => [window.innerWidth, window.innerHeight]).toEqual([width, height]);
}
