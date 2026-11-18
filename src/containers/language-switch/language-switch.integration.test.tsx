import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';

import { LanguageSwitch } from '@/containers/language-switch/language-switch';
import { overwriteGetLocale } from '@/paraglide/runtime';
import { renderWithRouter } from '@/test/render-with-router';

const LANGUAGES = [
  { locale: 'en', name: 'English', code: 'EN' },
  { locale: 'es', name: 'Español', code: 'ES' },
  { locale: 'pt', name: 'Português', code: 'PT' },
];

describe('LanguageSwitch', () => {
  afterEach(async () => {
    overwriteGetLocale(() => 'en');
    await page.viewport(1280, 800);
  });

  it('names each language in its own language and marks the current one', async () => {
    overwriteGetLocale(() => 'pt');
    const { screen } = await renderWithRouter(LanguageSwitch);

    await expect.element(screen.getByRole('navigation', { name: 'Idioma' })).toBeVisible();
    for (const { locale, name } of LANGUAGES) {
      const link = screen.getByRole('link', { name, exact: true });
      await expect.element(link).toHaveAttribute('lang', locale);
      await expect.element(link).toHaveAttribute('hreflang', locale);
    }
    await expect
      .element(screen.getByRole('link', { name: 'Português' }))
      .toHaveAttribute('aria-current', 'page');
    await expect
      .element(screen.getByRole('link', { name: 'English' }))
      .not.toHaveAttribute('aria-current');
  });

  it.each([375, 1440])(
    'shows two-letter codes at %i px and keeps the full names as accessible names',
    async (width) => {
      await page.viewport(width, 812);
      const { screen } = await renderWithRouter(LanguageSwitch);

      for (const { locale, name, code } of LANGUAGES) {
        const link = screen.getByRole('link', { name, exact: true });
        await expect.element(link).toHaveAttribute('lang', locale);
        const [codeLabel, nameLabel] = link.element().querySelectorAll('span');
        expect(codeLabel?.innerText).toBe(code);
        expect(nameLabel?.getBoundingClientRect().width).toBeLessThanOrEqual(1);
      }
    },
  );

  it('keeps every search param when switching language', async () => {
    const { screen, router } = await renderWithRouter(LanguageSwitch);
    await router.navigate({
      to: '/',
      search: { interval: '3d', minmag: 4, depth: 'deep', quake: 'usgs:us6000u18k', lat: 10 },
    });
    const { searchStr } = router.state.location;

    await expect
      .element(screen.getByRole('link', { name: 'Português' }))
      .toHaveAttribute('href', `/pt${searchStr}`);
    await expect
      .element(screen.getByRole('link', { name: 'Español' }))
      .toHaveAttribute('href', `/es${searchStr}`);
    expect(searchStr).toContain('quake=');
    expect(searchStr).toContain('minmag=4');
  });
});
