import { readFileSync } from 'node:fs';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { serviceWorker } from './content-build/pwa-plugin.ts';
import { generatedContent } from './content-build/vite-plugin.ts';

// The app is served from the repo's subpath on GitHub Pages; every asset and route must respect it.
export const BASE_PATH = '/my-practice-app/';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base: BASE_PATH,
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [preact(), generatedContent(process.env.CONTENT_OUT ?? '.generated/content'), serviceWorker()],
  build: { outDir: 'dist', emptyOutDir: true },
});
