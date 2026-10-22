// Writes <site>/sw.js after the build: the service worker template with its precache list filled in.
//
// The list is derived from what the build actually produced, never from a hand-kept glob:
//   - the app shell: every file in the output folder except content/ and the worker itself
//   - the content: manifest.json, the release log, the font subset, every lesson file, and every audio and stroke file those lessons
//     reference, plus the stroke data licence published with them
// A lesson that references audio or stroke data missing from the output fails the build instead of shipping a worker
// that could never finish installing.
import { createHash } from 'node:crypto';
import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';
import { listEntries, type LessonData } from '../src/content/types.ts';
import { FONT_REF } from './font.ts';
import { RELEASES_FILE } from './releases.ts';
import { STROKE_LICENCE_REF } from './strokes.ts';

const PLACEHOLDER = "/*PRECACHE*/ { buildId: 'dev', urls: [] }";
const WORKER_FILE = 'sw.js';

export interface Precache {
  buildId: string;
  /** Paths relative to the site root (the worker's scope), sorted. */
  urls: string[];
}

const exists = (file: string): Promise<boolean> =>
  access(file).then(
    () => true,
    () => false,
  );

/** Everything the app needs offline, found in a finished build output folder. */
export async function collectPrecache(outDir: string): Promise<Precache> {
  const urls = new Set<string>();
  for (const entry of await readdir(outDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const relative = path.relative(outDir, path.join(entry.parentPath, entry.name)).split(path.sep).join('/');
    if (relative === WORKER_FILE || relative.startsWith('content/') || relative.endsWith('.map')) continue;
    urls.add(relative);
  }

  const contentDir = path.join(outDir, 'content');
  urls.add('content/manifest.json');
  urls.add(`content/${RELEASES_FILE}`);
  // The font exists only when some lesson has Chinese items.
  if (await exists(path.join(contentDir, FONT_REF))) urls.add(`content/${FONT_REF}`);
  const lessonFiles = (await readdir(path.join(contentDir, 'lessons'))).filter((f) => f.endsWith('.json')).sort();
  for (const file of lessonFiles) {
    urls.add(`content/lessons/${file}`);
    const lesson = JSON.parse(await readFile(path.join(contentDir, 'lessons', file), 'utf8')) as LessonData;
    for (const [, items] of listEntries(lesson.lists)) {
      for (const item of items) {
        for (const ref of [item.audio.normal, item.audio.slow]) urls.add(`content/${ref}`);
        if (item.strokes) {
          urls.add(`content/${item.strokes}`);
          urls.add(`content/${STROKE_LICENCE_REF}`);
        }
      }
    }
  }

  const sorted = [...urls].sort();
  const digest = createHash('sha256');
  for (const url of sorted) {
    // A missing file throws here, which fails the build.
    digest.update(`${url}\0${createHash('sha256').update(await readFile(path.join(outDir, url))).digest('hex')}\n`);
  }
  return { buildId: digest.digest('hex').slice(0, 12), urls: sorted };
}

export async function writeServiceWorker(outDir: string, template: string): Promise<Precache> {
  if (!template.includes(PLACEHOLDER)) throw new Error('service worker template has no precache placeholder');
  const precache = await collectPrecache(outDir);
  await writeFile(path.join(outDir, WORKER_FILE), template.replace(PLACEHOLDER, () => JSON.stringify(precache)));
  return precache;
}

export function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'service-worker',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const template = await readFile(path.join(import.meta.dirname, 'service-worker.template.js'), 'utf8');
      await writeServiceWorker(outDir, template);
    },
  };
}
