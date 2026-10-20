import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildError, createWorkspace, lessonHeader } from './harness.ts';

/** A lesson file with a `stroke-order:` list (and optionally a `dictation:` list), each given as its item lines. */
function lesson(id: string, lists: { strokeOrder: string; dictation?: string; phrases?: string }): string {
  return (
    [
      ...lessonHeader(id),
      'stroke-order:',
      lists.strokeOrder,
      ...(lists.dictation === undefined ? [] : ['dictation:', lists.dictation]),
      ...(lists.phrases === undefined ? [] : ['phrase-recognition:', lists.phrases]),
    ].join('\n') + '\n'
  );
}

const strokeFiles = async (outDir: string): Promise<string[]> => {
  try {
    return (await readdir(path.join(outDir, 'strokes'))).sort();
  } catch {
    return [];
  }
};

describe('content validation: the stroke-order list', () => {
  it('accepts items with target, clue, pinyin and say, and lists the practice type after dictation', async () => {
    const ws = await createWorkspace({
      'chinese/x.yaml': lesson('x', {
        strokeOrder: '\n  - target: 一\n    clue: 一个\n    pinyin: yī\n  - target: 人\n    say: 大人的人\n',
        dictation: '\n  - target: 大\n',
      }),
    });
    const result = await ws.build();
    expect(result.warnings).toEqual([]);

    const data = await ws.lesson('x');
    expect(data.lists['stroke-order']!.map((i) => [i.target, i.clue, i.pinyin])).toEqual([
      ['一', '一个', 'yī'],
      ['人', undefined, 'rén'],
    ]);
    expect((await ws.manifest()).subjects[0]!.lessons[0]!.practiceTypes).toEqual([
      { id: 'dictation', itemCount: 1 },
      { id: 'stroke-order', itemCount: 2 },
    ]);
  });

  it('rejects a multi-character target, naming file, list, item and rule', async () => {
    const ws = await createWorkspace({
      'chinese/x.yaml': lesson('x', { strokeOrder: '\n  - target: 一\n  - target: 早上\n' }),
    });
    const message = await buildError(ws);
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('stroke-order item 2 (早上)');
    expect(message).toContain('[stroke-order-single-character]');
  });

  it('rejects an unknown item field, naming the list and item', async () => {
    const ws = await createWorkspace({
      'chinese/x.yaml': lesson('x', { strokeOrder: '\n  - target: 一\n    color: red\n' }),
    });
    const message = await buildError(ws);
    expect(message).toContain('stroke-order item 1 (一)');
    expect(message).toContain('[unknown-key]');
    expect(message).toContain('"color"');
  });

  it('rejects a character with no stroke data, naming file, list, item and character', async () => {
    // U+20000 is a Han character the stroke data does not cover.
    const ws = await createWorkspace({
      'chinese/x.yaml': lesson('x', { strokeOrder: '\n  - target: 一\n  - target: "\u{20000}"\n    pinyin: yī\n' }),
    });
    const message = await buildError(ws);
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('stroke-order item 2 (\u{20000})');
    expect(message).toContain('[stroke-data-missing]');
  });
});

describe('content build: stroke files', () => {
  it('writes one stroke file per distinct character and links it from each stroke-order item only', async () => {
    const ws = await createWorkspace({
      'chinese/x.yaml': lesson('x', {
        strokeOrder: '\n  - target: 一\n  - target: 人\n',
        dictation: '\n  - target: 一\n  - target: 大\n',
        phrases: '\n  - target: 一只狗\n',
      }),
    });
    await ws.build();

    const data = await ws.lesson('x');
    const items = data.lists['stroke-order']!;
    expect(items.map((i) => i.strokes)).toEqual([
      expect.stringMatching(/^strokes\/[0-9a-f]{12}\.json$/),
      expect.stringMatching(/^strokes\/[0-9a-f]{12}\.json$/),
    ]);
    expect(items[0]!.strokes).not.toBe(items[1]!.strokes);
    expect((await strokeFiles(ws.outDir)).map((f) => `strokes/${f}`).sort()).toEqual(items.map((i) => i.strokes!).sort());

    // The file holds the character's strokes (一 is a single stroke), as the drawing library reads them.
    const body = JSON.parse(await readFile(path.join(ws.outDir, items[0]!.strokes!), 'utf8')) as { strokes: string[]; medians: unknown[] };
    expect(body.strokes).toHaveLength(1);
    expect(body.medians).toHaveLength(1);

    // Dictation and phrase items are unchanged: no stroke reference.
    for (const item of [...data.lists.dictation!, ...data.lists['phrase-recognition']!]) {
      expect(item).not.toHaveProperty('strokes');
    }
  });

  it('shares one stroke file between lessons that use the same character', async () => {
    const ws = await createWorkspace({
      'chinese/a.yaml': lesson('a', { strokeOrder: '\n  - target: 大\n  - target: 人\n' }),
      'chinese/b.yaml': lesson('b', { strokeOrder: '\n  - target: 大\n' }),
    });
    await ws.build();
    const [a, b] = [await ws.lesson('a'), await ws.lesson('b')];
    expect(a.lists['stroke-order']![0]!.strokes).toBe(b.lists['stroke-order']![0]!.strokes);
    expect(await strokeFiles(ws.outDir)).toHaveLength(2);
  });

  it('shares the audio of a character that has the same target and clue in the dictation and stroke-order lists', async () => {
    const ws = await createWorkspace({
      'chinese/x.yaml': lesson('x', {
        strokeOrder: '\n  - target: 大\n    clue: 大人\n',
        dictation: '\n  - target: 大\n    clue: 大人\n',
      }),
    });
    await ws.build();
    const data = await ws.lesson('x');
    expect(data.lists['stroke-order']![0]!.audio).toEqual(data.lists.dictation![0]!.audio);
    expect(ws.provider.requests).toHaveLength(2); // normal and slow, once
  });

  it('changes the content version when the stroke-order list changes', async () => {
    const ws = await createWorkspace({ 'chinese/x.yaml': lesson('x', { strokeOrder: '\n  - target: 一\n' }) });
    const before = (await ws.build()).contentVersion;
    await ws.writeLessons({ 'chinese/x.yaml': lesson('x', { strokeOrder: '\n  - target: 一\n  - target: 人\n' }) });
    expect((await ws.build()).contentVersion).not.toBe(before);
  });
});
