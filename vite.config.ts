import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import { nitroV2Plugin } from '@tanstack/nitro-v2-vite-plugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 3000 },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  worker: { format: 'es' },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    nitroV2Plugin({ compatibilityDate: '2026-10-08', preset: process.env.NITRO_PRESET }),
    // react's vite plugin must come after start's vite plugin
    viteReact(),
  ],
});
