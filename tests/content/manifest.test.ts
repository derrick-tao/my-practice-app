import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createWorkspace, lessonYaml } from './harness.ts';

const THREE_ITEMS = `
  - target: 找
    clue: 找东西
    pinyin: zhǎo
  - target: 点
    clue: 几点
  - target: 分
    clue: 一分钟
    pinyin: fēn
`;

describe('content build: manifest and lesson data', () => {
  it('emits a manifest with subjects, lessons and the practice types each lesson offers with their item counts', async () => {
    const ws = await createWorkspace({
      'chinese/week-one.yaml': lessonYaml('week-one', THREE_ITEMS, {
        title: 'Week One',
        testDates: '2026-10-26 to 2026-10-30',
      }),
    });

    const result = await ws.build();
    const manifest = await ws.manifest();

    expect(manifest.contentVersion).toBe(result.contentVersion);
    expect(manifest.subjects).toEqual([
      {
        id: 'chinese',
        lessons: [
          {
            id: 'week-one',
            file: expect.stringMatching(/^lessons\/week-one\.[0-9a-f]{12}\.json$/),
            title: 'Week One',
            script: 'simplified',
            testDates: '2026-10-26 to 2026-10-30',
            practiceTypes: [{ id: 'dictation', itemCount: 3 }],
          },
        ],
      },
    ]);
  });

  it('omits testDates from the summary when the lesson has none', async () => {
    const ws = await createWorkspace({
      'chinese/no-dates.yaml': lessonYaml('no-dates', THREE_ITEMS),
    });
    await ws.build();
    const [summary] = (await ws.manifest()).subjects[0]!.lessons;
    expect(summary).not.toHaveProperty('testDates');
  });

  it('emits per-lesson data with a list per practice type: pinyin, clue and audio references', async () => {
    const ws = await createWorkspace({
      'chinese/week-one.yaml': lessonYaml('week-one', THREE_ITEMS, { title: 'Week One' }),
    });
    await ws.build();

    const lesson = await ws.lesson('week-one');
    expect(lesson.id).toBe('week-one');
    expect(lesson.title).toBe('Week One');
    expect(Object.keys(lesson.lists)).toEqual(['dictation']);
    expect(lesson.lists.dictation!.map((item) => item.target)).toEqual(['找', '点', '分']);
    expect(lesson.lists.dictation![0]).toMatchObject({ target: '找', clue: '找东西', pinyin: 'zhǎo' });

    for (const item of lesson.lists.dictation!) {
      expect(item.audio.normal).toMatch(/^audio\/[0-9a-f]{32}\.mp3$/);
      expect(item.audio.slow).toMatch(/^audio\/[0-9a-f]{32}\.mp3$/);
      expect(item.audio.normal).not.toBe(item.audio.slow);
    }
  });

  it('writes every referenced audio file into the output', async () => {
    const ws = await createWorkspace({
      'chinese/week-one.yaml': lessonYaml('week-one', THREE_ITEMS),
    });
    await ws.build();
    const lesson = await ws.lesson('week-one');
    const referenced = lesson.lists.dictation!.flatMap((item) => [item.audio.normal, item.audio.slow]);
    const written = (await ws.outputAudio()).map((name) => `audio/${name}`);
    expect(written.sort()).toEqual([...referenced].sort());
  });

  it('names each lesson file by its content, so a file never changes under the same name', async () => {
    const ws = await createWorkspace({
      'chinese/a.yaml': lessonYaml('a', THREE_ITEMS, { title: 'A' }),
      'chinese/b.yaml': lessonYaml('b', THREE_ITEMS, { title: 'B' }),
    });
    await ws.build();
    const fileOf = async (id: string): Promise<string> =>
      (await ws.manifest()).subjects[0]!.lessons.find((l) => l.id === id)!.file;
    const [aBefore, bBefore] = [await fileOf('a'), await fileOf('b')];
    expect(aBefore).not.toBe(bBefore);

    await ws.build(); // same content, built again
    expect([await fileOf('a'), await fileOf('b')]).toEqual([aBefore, bBefore]);

    await ws.writeLessons({ 'chinese/a.yaml': lessonYaml('a', THREE_ITEMS, { title: 'A, edited' }) });
    await ws.build();
    expect(await fileOf('a')).not.toBe(aBefore);
    expect(await fileOf('b')).toBe(bBefore);
    expect((await ws.lesson('a')).title).toBe('A, edited');
    // Only files the manifest points at are published.
    expect((await readdir(path.join(ws.outDir, 'lessons'))).sort()).toEqual(
      [await fileOf('a'), await fileOf('b')].map((f) => path.basename(f)).sort(),
    );
  });
});
