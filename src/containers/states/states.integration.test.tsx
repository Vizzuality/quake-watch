import { afterEach, describe, expect, it } from 'vitest';

import { ErrorState } from '@/containers/states/error';
import { NotFound } from '@/containers/states/not-found';
import { overwriteGetLocale } from '@/paraglide/runtime';
import { renderWithRouter } from '@/test/render-with-router';

describe('page states', () => {
  afterEach(() => {
    overwriteGetLocale(() => 'en');
  });

  it('not-found shows one line and a link back to the globe', async () => {
    const { screen } = await renderWithRouter(NotFound);

    await expect.element(screen.getByRole('heading', { name: 'Nothing here.' })).toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Back to the globe' }))
      .toHaveAttribute('href', '/');
  });

  it('error announces one line, links back to the globe and offers no retry', async () => {
    const { screen } = await renderWithRouter(ErrorState);

    await expect.element(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
    await expect
      .element(screen.getByRole('link', { name: 'Back to the globe' }))
      .toHaveAttribute('href', '/');
    expect(screen.container.querySelectorAll('button')).toHaveLength(0);
  });

  it('renders both states in Spanish', async () => {
    overwriteGetLocale(() => 'es');
    const notFound = await renderWithRouter(NotFound);
    await expect.element(notFound.screen.getByText('Aquí no hay nada.')).toBeVisible();
    await expect
      .element(notFound.screen.getByRole('link', { name: 'Volver al globo' }))
      .toBeVisible();
    notFound.screen.unmount();

    const error = await renderWithRouter(ErrorState);
    await expect.element(error.screen.getByRole('alert')).toHaveTextContent('Algo ha ido mal.');
  });
});
