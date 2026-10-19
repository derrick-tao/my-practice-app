// Seam 1 harness for the offline / update specs: a small static server over the built fixture app
// (`dist-e2e`) that can "deploy a new version" while a page is open, by overlaying changed files on top
// of the build. It stands in for GitHub Pages receiving a new deploy.
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { expect, test as base } from './harness.ts';
import { BASE_PATH } from './servers.ts';

const DIST = path.resolve('dist-e2e');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

export const NEW_TITLE = 'Fixture Three Reloaded';

export interface PwaSite {
  baseURL: string;
  /** Publish a new version of the content (retitles Fixture Three) and of the service worker. */
  deployNewVersion(): Promise<void>;
}

async function startSite(): Promise<{ site: PwaSite; server: Server }> {
  const overlay = new Map<string, string>();
  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (!url.pathname.startsWith(BASE_PATH)) return void res.writeHead(404).end();
      const rel = decodeURIComponent(url.pathname.slice(BASE_PATH.length)) || 'index.html';
      const file = path.resolve(DIST, rel);
      if (!file.startsWith(DIST + path.sep)) return void res.writeHead(404).end();
      try {
        const body = overlay.has(rel) ? Buffer.from(overlay.get(rel)!) : await readFile(file);
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(body);
      } catch {
        res.writeHead(404).end();
      }
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}${BASE_PATH}`;

  const site: PwaSite = {
    baseURL,
    async deployNewVersion() {
      const read = async (rel: string) => readFile(path.join(DIST, rel), 'utf8');
      const manifest = JSON.parse(await read('content/manifest.json')) as {
        contentVersion: string;
        subjects: Array<{ lessons: Array<{ id: string; title: string; file: string }> }>;
      };
      const entries = manifest.subjects.flatMap((s) => s.lessons);
      const entry = entries.find((e) => e.id === 'fixture-three')!;

      // Lesson files are named by their content, so a changed lesson is a new file next to the old one.
      const lesson = JSON.parse(await read(`content/${entry.file}`)) as { title: string };
      lesson.title = NEW_TITLE;
      const newFile = 'lessons/fixture-three.deployed-later.json';
      overlay.set(`content/${newFile}`, JSON.stringify(lesson));

      const oldFile = entry.file;
      manifest.contentVersion = 'deployed-later';
      for (const e of entries) {
        if (e.id === 'fixture-three') Object.assign(e, { title: NEW_TITLE, file: newFile });
      }
      overlay.set('content/manifest.json', JSON.stringify(manifest));

      // A deploy with changed content produces a service worker with a different build id and precache lesson.
      const worker = await read('sw.js');
      expect(worker).toMatch(/"buildId":"[^"]*"/);
      expect(worker).toContain(`content/${oldFile}`);
      overlay.set(
        'sw.js',
        worker.replace(/"buildId":"[^"]*"/, '"buildId":"deployed-later"').replace(`content/${oldFile}`, `content/${newFile}`),
      );
    },
  };
  return { site, server };
}

export const test = base.extend<{ site: PwaSite }>({
  serviceWorkers: 'allow',
  site: async ({}, use) => {
    const { site, server } = await startSite();
    await use(site);
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  },
  baseURL: async ({ site }, use) => {
    await use(site.baseURL);
  },
});

export { expect };
