// Serves the generated content folder at `<base>content/` in dev, and copies it into the build
// output so the deployed site has `<site>/content/manifest.json`, lists and audio.
//
// The folder is produced by `content-build/cli.ts build` (see package.json scripts). Pointing
// `CONTENT_OUT` at a different folder is how the e2e build swaps in fixture content.
import { cp, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';

const MIME: Record<string, string> = {
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
};

export function generatedContent(contentDir: string): Plugin {
  let base = '/';
  let outDir = 'dist';
  const root = path.resolve(contentDir);

  return {
    name: 'generated-content',
    configResolved(config) {
      base = config.base;
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const prefix = `${base}content/`;
        const url = (req.url ?? '').split('?')[0]!;
        if (!url.startsWith(prefix)) return next();
        const file = path.join(root, decodeURIComponent(url.slice(prefix.length)));
        if (!file.startsWith(root + path.sep)) return next();
        try {
          if (!(await stat(file)).isFile()) return next();
          res.setHeader('Content-Type', MIME[path.extname(file)] ?? 'application/octet-stream');
          res.end(await readFile(file));
        } catch {
          next();
        }
      });
    },
    async writeBundle() {
      await cp(root, path.join(outDir, 'content'), { recursive: true });
    },
  };
}
