import { readFileSync } from 'node:fs';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { serviceWorker } from './content-build/pwa-plugin.ts';
import { newestRelease } from './content-build/releases.ts';
import { generatedContent } from './content-build/vite-plugin.ts';

// The app is served from the repo's subpath on GitHub Pages; every asset and route must respect it.
export const BASE_PATH = '/my-practice-app/';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

const contentOut = process.env.CONTENT_OUT ?? '.generated/content';

export default defineConfig(({ isPreview }) => ({
  base: BASE_PATH,
  // The newest release in the built log is the release this build is. (Preview only serves an existing build,
  // so it needs no content folder; every other command throws if `content:build` has not run.)
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __RELEASE__: JSON.stringify((isPreview ? undefined : newestRelease(contentOut)) ?? null),
  },
  plugins: [preact(), generatedContent(contentOut), serviceWorker()],
  build: { outDir: 'dist', emptyOutDir: true },
}));
