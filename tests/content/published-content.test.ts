import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildContent } from '../../content-build/build.ts';
import { createFakeProvider } from '../../content-build/tts/fake-provider.ts';
import type { ListData, Manifest } from '../../src/content/types.ts';
import { readFile } from 'node:fs/promises';

// Guards the real content/ folder: whatever the parent publishes must validate and build.
describe('the real published content', () => {
  it('validates and builds, with the Fall 2026 Assessment list (37 items) in the manifest', async () => {
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
    const summaries = manifest.subjects.flatMap((s) => s.practiceTypes.flatMap((t) => t.lists));
    expect(summaries).toContainEqual({
      id: 'fall-2026-assessment',
      file: expect.stringMatching(/^lists\/fall-2026-assessment\.[0-9a-f]{12}\.json$/),
      title: 'Fall 2026 Assessment',
      script: 'simplified',
      testDates: '2026-10-26 to 2026-10-30',
      itemCount: 37,
    });

    const { file } = summaries.find((l) => l.id === 'fall-2026-assessment')!;
    const list = JSON.parse(await readFile(path.join(outDir, file), 'utf8')) as ListData;
    const targets = list.items.map((item) => item.target).join('');
    expect(targets).toBe('找点分作业半玩做车可以买东西后午晚安家看书洗想吃米饭面喝什么猫狗今年养只鸟');
    const byTarget = Object.fromEntries(list.items.map((item) => [item.target, item.pinyin]));
    expect(byTarget).toMatchObject({ 什: 'shén', 么: 'me', 只: 'zhī', 分: 'fēn' });
  });
});
