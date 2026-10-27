import path from 'node:path';

import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { nitroV2Plugin } from '@tanstack/nitro-v2-vite-plugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { paraglideOptions } from './paraglide.config';

export default defineConfig({
  server: { port: 3000 },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  worker: { format: 'es' },
  build: {
    modulePreload: {
      // WebKit caches a failed <link rel=modulepreload> across reloads: https://bugs.webkit.org/show_bug.cgi?id=270357
      resolveDependencies: (url, deps) => deps.filter((dep) => dep !== url),
    },
  },
  plugins: [
    paraglideVitePlugin(paraglideOptions),
    tailwindcss(),
    tanstackStart(),
    nitroV2Plugin({ compatibilityDate: '2026-10-08', preset: process.env.NITRO_PRESET }),
    // react's vite plugin must come after start's vite plugin
    viteReact(),
  ],
});
