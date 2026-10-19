import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildContent } from '../../content-build/build.ts';
import { createFakeProvider } from '../../content-build/tts/fake-provider.ts';
import type { LessonData, Manifest } from '../../src/content/types.ts';

// Guards the real content/ folder: whatever the parent publishes must validate and build.
describe('the real published content', () => {
  it('validates and builds, with the Fall 2026 Assessment lesson (37 dictation items) in the manifest', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'published-'));
    const outDir = path.join(root, 'out');
    const result = await buildContent({
      contentDir: path.resolve('content'),
      outDir,
      audioStoreDir: path.join(root, 'audio'),
      provider: createFakeProvider(),
    });
    expect(result.warnings).toEqual([]);

    const manifest = JSON.parse(await readFile(path.join(outDir, 'manifest.json'), 'utf8')) as Manifest;
    const summaries = manifest.subjects.flatMap((s) => s.lessons);
    expect(summaries).toContainEqual({
      id: 'fall-2026-assessment',
      file: expect.stringMatching(/^lessons\/fall-2026-assessment\.[0-9a-f]{12}\.json$/),
      title: 'Fall 2026 Assessment',
      script: 'simplified',
      testDates: '2026-10-26 to 2026-10-30',
      practiceTypes: [{ id: 'dictation', itemCount: 37 }],
    });

    const { file } = summaries.find((l) => l.id === 'fall-2026-assessment')!;
    const lesson = JSON.parse(await readFile(path.join(outDir, file), 'utf8')) as LessonData;
    const dictation = lesson.lists.dictation!;
    const targets = dictation.map((item) => item.target).join('');
    expect(targets).toBe('找点分作业半玩做车可以买东西后午晚安家看书洗想吃米饭面喝什么猫狗今年养只鸟');
    const byTarget = Object.fromEntries(dictation.map((item) => [item.target, item.pinyin]));
    expect(byTarget).toMatchObject({ 什: 'shén', 么: 'me', 只: 'zhī', 分: 'fēn' });
  });

  it('rebuilds the Fall 2026 dictation content against the committed audio with zero TTS requests', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'published-'));
    const requests: string[] = [];
    const failingFetch = (async (url: string | URL | Request) => {
      requests.push(String(url));
      throw new Error('no TTS request is expected');
    }) as typeof fetch;

    const result = await buildContent({
      contentDir: path.resolve('content'),
      outDir: path.join(root, 'out'),
      audioStoreDir: path.resolve('audio'),
      providerDeps: {
        env: { AZURE_SPEECH_KEY: 'test-key', AZURE_SPEECH_REGION: 'eastus' },
        fetch: failingFetch,
      },
    });

    expect(requests).toEqual([]);
    expect(result.audio.requested).toBe(0);
    expect(result.audio.needed).toBe(74); // 37 characters, normal and slow
  });
});
