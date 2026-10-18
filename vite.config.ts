import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { generatedContent } from './content-build/vite-plugin.ts';

// The app is served from the repo's subpath on GitHub Pages; every asset and route must respect it.
export const BASE_PATH = '/my-practice-app/';

export default defineConfig({
  base: BASE_PATH,
  plugins: [preact(), generatedContent(process.env.CONTENT_OUT ?? '.generated/content')],
  build: { outDir: 'dist', emptyOutDir: true },
});
