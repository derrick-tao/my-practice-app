// Seam 2: the word-problems math practice type (ticket 53). Like every math practice type it holds rules, not items.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildError, createWorkspace, lessonYaml } from './harness.ts';

const mathLesson = (id: string, body: string): string => [`id: ${id}`, 'title: Math Test', 'subject: math', body].join('\n') + '\n';

const CHINESE_ITEM = '\n  - target: 找\n    clue: 找东西\n    pinyin: zhǎo\n';

describe('word-problems lessons build', () => {
  it('offers Stories in the manifest after Facts, with 20 problems and the default rules', async () => {
    const ws = await createWorkspace({ 'math/m.yaml': mathLesson('m', 'word-problems:\n  within: 20\nfacts:\n  within: 20') });
    await ws.build();

    const [math] = (await ws.manifest()).subjects;
    expect(math!.lessons[0]!.practiceTypes).toEqual([
      { id: 'facts', itemCount: 20 },
      { id: 'word-problems', itemCount: 20 },
    ]);
    expect((await ws.lesson('m')).rules).toEqual({
      facts: { within: 20, operations: ['add', 'subtract'] },
      'word-problems': { within: 20, operations: ['add', 'subtract'] },
    });
  });

  it('keeps the rules a lesson sets', async () => {
    const ws = await createWorkspace({ 'math/m.yaml': mathLesson('m', 'word-problems:\n  within: 100\n  operations: [subtract]\n') });
    await ws.build();

    expect((await ws.lesson('m')).rules).toEqual({ 'word-problems': { within: 100, operations: ['subtract'] } });
  });

  it('is in the real Fall 2026 Math Assessment, within 20', async () => {
    const ws = await createWorkspace({
      'math/fall-2026-math-assessment.yaml': await readFile(path.resolve('content/math/fall-2026-math-assessment.yaml'), 'utf8'),
    });
    await ws.build();

    expect((await ws.lesson('fall-2026-math-assessment')).rules?.['word-problems']).toEqual({
      within: 20,
      operations: ['add', 'subtract'],
    });
  });
});

describe('word-problems lessons are validated', () => {
  it('rejects word-problems in a Chinese lesson', async () => {
    const message = await buildError(await createWorkspace({ 'chinese/x.yaml': lessonYaml('x', CHINESE_ITEM) + 'word-problems:\n  within: 20\n' }));
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('[wrong-subject]');
    expect(message).toContain('"word-problems"');
  });

  it.each([
    ['within: 5', '"within"'],
    ['within: 150', '"within"'],
    ['operations: [multiply]', '"multiply"'],
    ['operations: []', '"operations"'],
    ['colour: red', '"colour"'],
  ])('rejects the rules "%s"', async (rule, mentioned) => {
    const message = await buildError(await createWorkspace({ 'math/x.yaml': mathLesson('x', `word-problems:\n  ${rule}\n`) }));
    expect(message).toContain('math/x.yaml');
    expect(message).toContain('word-problems');
    expect(message).toContain(mentioned);
  });

  it('rejects rules that are not a mapping', async () => {
    const message = await buildError(await createWorkspace({ 'math/x.yaml': mathLesson('x', 'word-problems:\n  - Mia has 8 apples\n') }));
    expect(message).toContain('math/x.yaml');
    expect(message).toContain('[invalid-value]');
  });
});
