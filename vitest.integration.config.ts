import path from 'node:path';

import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import viteReact from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

import { paraglideOptions } from './paraglide.config';

export default defineConfig({
  plugins: [paraglideVitePlugin(paraglideOptions), tailwindcss(), viteReact()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    include: ['src/**/*.integration.test.tsx'],
    setupFiles: ['./src/test/setup-network.ts', './src/test/setup-integration.ts'],
    unstubGlobals: true,
    testTimeout: 15_000,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({ contextOptions: { timezoneId: 'UTC', locale: 'en-US' } }),
      instances: [{ browser: 'chromium', viewport: { width: 1280, height: 800 } }],
    },
  },
});
