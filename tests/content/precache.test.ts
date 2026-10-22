import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectPrecache } from '../../content-build/pwa-plugin.ts';
import type { LessonData, Manifest } from '../../src/content/types.ts';
import { createWorkspace, lessonHeader, lessonYaml } from './harness.ts';

/** Build lesson files' content into `<site>/content/` beside a stand-in app shell, as the production build lays out the site. */
async function site(lessons: Record<string, string>, lessonId = 'x'): Promise<{ siteDir: string; strokes: string[] }> {
  const ws = await createWorkspace(lessons);
  const siteDir = await mkdtemp(path.join(tmpdir(), 'precache-site-'));
  await ws.build({ outDir: path.join(siteDir, 'content') });
  await writeFile(path.join(siteDir, 'index.html'), '<!doctype html>');
  const content = path.join(siteDir, 'content');
  const manifest = JSON.parse(await readFile(path.join(content, 'manifest.json'), 'utf8')) as Manifest;
  const entry = manifest.subjects.flatMap((s) => s.lessons).find((l) => l.id === lessonId)!;
  const lesson = JSON.parse(await readFile(path.join(content, entry.file), 'utf8')) as LessonData;
  const items = lesson.lists['stroke-order'] ?? [];
  return { siteDir, strokes: items.map((item) => item.strokes!) };
}

const STROKE_LESSON = [...lessonHeader('x'), 'stroke-order:', '  - target: 一', '  - target: 人', ''].join('\n');

describe('service worker precache: stroke data', () => {
  it('lists every referenced stroke file and the licence published with them', async () => {
    const { siteDir, strokes } = await site({ 'chinese/x.yaml': STROKE_LESSON });
    expect(strokes).toHaveLength(2);
    const { urls } = await collectPrecache(siteDir);
    expect(urls).toEqual(expect.arrayContaining([...strokes.map((ref) => `content/${ref}`), 'content/strokes/ARPHICPL.TXT']));
  });

  it('fails when a referenced stroke file is missing from the output', async () => {
    const { siteDir, strokes } = await site({ 'chinese/x.yaml': STROKE_LESSON });
    await rm(path.join(siteDir, 'content', strokes[0]!));
    await expect(collectPrecache(siteDir)).rejects.toThrow(/ENOENT/);
  });

  it('fails when the licence is missing from the output', async () => {
    const { siteDir } = await site({ 'chinese/x.yaml': STROKE_LESSON });
    await rm(path.join(siteDir, 'content', 'strokes', 'ARPHICPL.TXT'));
    await expect(collectPrecache(siteDir)).rejects.toThrow(/ENOENT/);
  });

  it('adds nothing for content without stroke-order lists', async () => {
    const { siteDir } = await site({ 'chinese/y.yaml': lessonYaml('y', '\n  - target: 大\n') }, 'y');
    const { urls } = await collectPrecache(siteDir);
    expect(urls.filter((url) => url.startsWith('content/strokes/'))).toEqual([]);
  });
});

describe('service worker precache: release log', () => {
  it('lists the release log so a fresh install has a copy to read offline', async () => {
    const { siteDir } = await site({ 'chinese/x.yaml': lessonYaml('x', '\n  - target: 大\n') });
    const { urls } = await collectPrecache(siteDir);
    expect(urls).toContain('content/releases.json');
  });

  it('fails when the release log is missing from the output', async () => {
    const { siteDir } = await site({ 'chinese/x.yaml': lessonYaml('x', '\n  - target: 大\n') });
    await rm(path.join(siteDir, 'content', 'releases.json'));
    await expect(collectPrecache(siteDir)).rejects.toThrow(/ENOENT/);
  });
});

describe('service worker precache: math lessons', () => {
  it('caches the math lesson and manifest, with no font, audio or stroke files', async () => {
    const { siteDir } = await site({ 'math/m.yaml': 'id: m\ntitle: Math\nsubject: math\nfacts:\n  within: 20\n' }, 'm');
    const { urls } = await collectPrecache(siteDir);
    const content = urls.filter((url) => url.startsWith('content/'));
    expect(content).toEqual([
      expect.stringMatching(/^content\/lessons\/m\.[0-9a-f]{12}\.json$/),
      'content/manifest.json',
      'content/releases.json',
    ]);
  });
});
