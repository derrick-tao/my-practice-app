import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { convert } from 'fontverter';
import opentype from 'opentype.js';
import { describe, expect, it } from 'vitest';
import { buildError, createWorkspace, lessonHeader } from './harness.ts';

/** A lesson file with a `dictation:` and/or `phrase-recognition:` list (each given as its item lines). */
function lesson(id: string, lists: { dictation?: string; phrases?: string }): string {
  return (
    [
      ...lessonHeader(id),
      ...(lists.dictation === undefined ? [] : ['dictation:', lists.dictation]),
      ...(lists.phrases === undefined ? [] : ['phrase-recognition:', lists.phrases]),
    ].join('\n') + '\n'
  );
}

describe('content validation: the phrase-recognition list', () => {
  it('rejects clue on a phrase item, naming file, practice type, item and rule', async () => {
    const ws = await createWorkspace({
      'chinese/x.yaml': lesson('x', { phrases: '\n  - target: 早上\n    clue: 早上好\n' }),
    });
    const message = await buildError(ws);
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('phrase-recognition item 1 (早上)');
    expect(message).toContain('[unknown-key]');
    expect(message).toContain('"clue"');
  });

  it('rejects a target duplicated within the phrase list', async () => {
    const ws = await createWorkspace({
      'chinese/x.yaml': lesson('x', { phrases: '\n  - target: 书包\n  - target: 作业\n  - target: 书包\n' }),
    });
    const message = await buildError(ws);
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('phrase-recognition item 3 (书包)');
    expect(message).toContain('[target-duplicate]');
    expect(message).toContain('repeats item 1');
  });

  it('rejects a phrase whose pinyin has the wrong number of syllables', async () => {
    const ws = await createWorkspace({
      'chinese/x.yaml': lesson('x', { phrases: '\n  - target: 早上\n    pinyin: zǎo\n' }),
    });
    const message = await buildError(ws);
    expect(message).toContain('phrase-recognition item 1 (早上)');
    expect(message).toContain('[pinyin-syllable-count]');
  });

  it('accepts a target shared by the dictation and phrase lists, as separate items', async () => {
    const ws = await createWorkspace({
      'chinese/x.yaml': lesson('x', {
        dictation: '\n  - target: 猫\n    clue: 小猫\n',
        phrases: '\n  - target: 猫\n  - target: 三只猫\n',
      }),
    });
    const result = await ws.build();
    expect(result.warnings).toEqual([]);

    const data = await ws.lesson('x');
    expect(data.lists.dictation!.map((i) => i.target)).toEqual(['猫']);
    expect(data.lists['phrase-recognition']!.map((i) => i.target)).toEqual(['猫', '三只猫']);
    const manifest = await ws.manifest();
    expect(manifest.subjects[0]!.lessons[0]!.practiceTypes).toEqual([
      { id: 'dictation', itemCount: 1 },
      { id: 'phrase-recognition', itemCount: 2 },
    ]);
  });
});

describe('content build: phrase pinyin', () => {
  it('generates omitted phrase pinyin and keeps provided pinyin', async () => {
    const ws = await createWorkspace({
      'chinese/x.yaml': lesson('x', {
        phrases: '\n  - target: 书包\n  - target: 早上\n    pinyin: zǎo shang\n  - target: 猫\n',
      }),
    });
    await ws.build();
    const phrases = (await ws.lesson('x')).lists['phrase-recognition']!;
    expect(phrases.map((p) => p.pinyin)).toEqual(['shū bāo', 'zǎo shang', 'māo']);
    expect(phrases.every((p) => p.clue === undefined)).toBe(true);
  });
});

describe('content build: phrase audio requests', () => {
  it('asks for the phrase alone, normal and slow, with no phoneme markup for a multi-character phrase', async () => {
    const ws = await createWorkspace({
      'chinese/x.yaml': lesson('x', { phrases: '\n  - target: 鞋子\n    pinyin: xié zi\n' }),
    });
    await ws.build();
    const requests = ws.provider.requests;
    expect(requests.map((r) => [r.text, r.rate])).toEqual([
      ['鞋子', '0%'],
      ['鞋子', '-30%'],
    ]);
    for (const request of requests) {
      expect(request.ssml).not.toContain('<phoneme');
      expect(request.ssml).toContain('鞋子');
    }
  });

  it('speaks the say override verbatim, and keeps the phoneme tag for a single-character phrase', async () => {
    const ws = await createWorkspace({
      'chinese/x.yaml': lesson('x', {
        phrases: '\n  - target: 猫\n  - target: 买东西\n    say: 去买东西\n',
      }),
    });
    await ws.build();
    const [cat, , buy] = ws.provider.requests;
    expect(cat!.ssml).toContain('<phoneme alphabet="sapi" ph="mao 1">猫</phoneme>');
    expect(buy!.text).toBe('去买东西');
    expect(buy!.ssml).not.toContain('<phoneme');
  });
});

describe('content build: Kai font subset covers phrases', () => {
  it('has a glyph for every character of a phrase list', async () => {
    const ws = await createWorkspace({
      'chinese/x.yaml': lesson('x', { phrases: '\n  - target: 收拾房间\n  - target: 四只仓鼠\n' }),
    });
    await ws.build();
    const woff2 = await readFile(path.join(ws.outDir, 'fonts/practice-kai.woff2'));
    const sfnt = await convert(woff2, 'sfnt');
    const font = opentype.parse(sfnt.buffer.slice(sfnt.byteOffset, sfnt.byteOffset + sfnt.byteLength) as ArrayBuffer);
    const chars = [...new Set('收拾房间四只仓鼠')];
    expect(chars.filter((c) => font.charToGlyphIndex(c) > 0)).toEqual(chars);
  });
});
