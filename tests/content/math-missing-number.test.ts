// Seam 2: the Missing number practice type (ticket 50). A math lesson offers it with `missing-number` rules, which are
// validated like every rules practice type, and it belongs to the math subject only.
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { buildError, createWorkspace, lessonYaml } from './harness.ts';

const mathLesson = (id: string, body: string): string => `id: ${id}\ntitle: Math Test\nsubject: math\n${body}`;
const CHINESE_ITEM = '\n  - target: 找\n    clue: 找东西\n    pinyin: zhǎo\n';

describe('a lesson with missing-number rules', () => {
  it('is offered as a Missing number practice type of 20 problems, next to Facts in registry order', async () => {
    const ws = await createWorkspace({ 'math/m.yaml': mathLesson('m', 'missing-number:\n  within: 20\nfacts:\n  within: 20\n') });
    await ws.build();

    const [math] = (await ws.manifest()).subjects;
    expect(math!.lessons[0]!.practiceTypes).toEqual([
      { id: 'facts', itemCount: 20 },
      { id: 'missing-number', itemCount: 20 },
    ]);
    expect((await ws.lesson('m')).rules).toEqual({
      facts: { within: 20, operations: ['add', 'subtract'] },
      'missing-number': { within: 20, operations: ['add', 'subtract'] },
    });
  });

  it('keeps the rules it sets and defaults the rest, and does no audio work', async () => {
    const ws = await createWorkspace({
      'math/a.yaml': mathLesson('a', 'missing-number:\n  within: 100\n  operations: [subtract]\n'),
      'math/b.yaml': mathLesson('b', 'missing-number: {}\n'),
    });
    await ws.build();

    expect((await ws.lesson('a')).rules).toEqual({ 'missing-number': { within: 100, operations: ['subtract'] } });
    expect((await ws.lesson('b')).rules).toEqual({ 'missing-number': { within: 20, operations: ['add', 'subtract'] } });
    expect(ws.provider.requests).toEqual([]);
  });
});

describe('the real Fall 2026 Math Assessment', () => {
  it('ships Missing number within 20, and builds', async () => {
    const yaml = await readFile('content/math/fall-2026-math-assessment.yaml', 'utf8');
    const ws = await createWorkspace({ 'math/fall-2026-math-assessment.yaml': yaml });
    await ws.build();

    const lesson = await ws.lesson('fall-2026-math-assessment');
    expect(lesson.rules!['missing-number']).toEqual({ within: 20, operations: ['add', 'subtract'] });
  });
});

describe('missing-number rules are validated', () => {
  it('rejects the practice type in a Chinese lesson', async () => {
    const yaml = lessonYaml('x', CHINESE_ITEM) + 'missing-number:\n  within: 20\n';
    const message = await buildError(await createWorkspace({ 'chinese/x.yaml': yaml }));
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('[wrong-subject]');
    expect(message).toContain('"missing-number"');
  });

  it.each([
    ['within: 5', '"within"'],
    ['within: 150', '"within"'],
    ['within: lots', '"within"'],
    ['operations: [multiply]', '"multiply"'],
    ['operations: []', '"operations"'],
    ['colour: red', '"colour"'],
  ])('rejects the rules "%s"', async (rule, mentioned) => {
    const message = await buildError(await createWorkspace({ 'math/x.yaml': mathLesson('x', `missing-number:\n  ${rule}\n`) }));
    expect(message).toContain('math/x.yaml');
    expect(message).toContain('missing-number');
    expect(message).toContain(mentioned);
  });

  it('rejects rules that are not a mapping', async () => {
    const message = await buildError(await createWorkspace({ 'math/x.yaml': mathLesson('x', 'missing-number:\n  - 8 + ? = 11\n') }));
    expect(message).toContain('math/x.yaml');
    expect(message).toContain('missing-number');
    expect(message).toContain('[invalid-value]');
  });
});
