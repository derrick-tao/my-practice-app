// Seam 2: the true-or-false practice type (ticket 51) in a math lesson: its rules are validated like Facts' and
// the lesson builds with the type offered, 20 problems to a session.
import { describe, expect, it } from 'vitest';
import { buildError, createWorkspace, lessonYaml } from './harness.ts';

const mathLesson = (id: string, body: string): string => `id: ${id}\ntitle: Math Test\nsubject: math\n${body}`;

const CHINESE_ITEM = '\n  - target: 找\n    clue: 找东西\n    pinyin: zhǎo\n';

describe('a true-or-false lesson builds', () => {
  it('offers true-or-false in the manifest after facts, with 20 problems, and keeps its rules (defaults filled in)', async () => {
    const ws = await createWorkspace({
      'math/m.yaml': mathLesson('m', 'true-or-false:\n  within: 20\nfacts:\n  within: 20\n'),
      'math/defaults.yaml': mathLesson('defaults', 'true-or-false: {}\n'),
      'math/subtracting.yaml': mathLesson('subtracting', 'true-or-false:\n  within: 100\n  operations: [subtract]\n'),
    });
    const result = await ws.build();

    const manifest = await ws.manifest();
    const lesson = manifest.subjects.find((s) => s.id === 'math')!.lessons.find((l) => l.id === 'm')!;
    expect(lesson.practiceTypes).toEqual([
      { id: 'facts', itemCount: 20 },
      { id: 'true-or-false', itemCount: 20 },
    ]);
    expect((await ws.lesson('m')).rules).toEqual({
      facts: { within: 20, operations: ['add', 'subtract'] },
      'true-or-false': { within: 20, operations: ['add', 'subtract'] },
    });
    expect((await ws.lesson('defaults')).rules).toEqual({ 'true-or-false': { within: 20, operations: ['add', 'subtract'] } });
    expect((await ws.lesson('subtracting')).rules).toEqual({ 'true-or-false': { within: 100, operations: ['subtract'] } });
    expect(ws.provider.requests).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

describe('a true-or-false lesson is validated', () => {
  it('rejects true-or-false in a Chinese lesson', async () => {
    const yaml = lessonYaml('x', CHINESE_ITEM) + 'true-or-false:\n  within: 20\n';
    const message = await buildError(await createWorkspace({ 'chinese/x.yaml': yaml }));
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('[wrong-subject]');
    expect(message).toContain('"true-or-false"');
  });

  it.each([
    ['within: 5', '"within"'],
    ['within: 150', '"within"'],
    ['within: lots', '"within"'],
    ['operations: [multiply]', '"multiply"'],
    ['operations: []', '"operations"'],
    ['colour: red', '"colour"'],
  ])('rejects the rules "%s"', async (rule, mentioned) => {
    const message = await buildError(await createWorkspace({ 'math/x.yaml': mathLesson('x', `true-or-false:\n  ${rule}\n`) }));
    expect(message).toContain('math/x.yaml');
    expect(message).toContain('true-or-false');
    expect(message).toContain(mentioned);
  });

  it('rejects rules that are not a mapping', async () => {
    const message = await buildError(await createWorkspace({ 'math/x.yaml': mathLesson('x', 'true-or-false:\n  - 1 + 2 = 3\n') }));
    expect(message).toContain('math/x.yaml');
    expect(message).toContain('true-or-false');
    expect(message).toContain('[invalid-value]');
  });
});
