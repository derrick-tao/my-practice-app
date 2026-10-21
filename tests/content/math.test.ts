// Seam 2: a math lesson holds rules, not items. It builds without any audio, pinyin or font work, shows up in
// the manifest with its practice types, and a practice type belongs to exactly one subject.
import { describe, expect, it } from 'vitest';
import { buildError, createWorkspace, lessonYaml } from './harness.ts';

const mathLesson = (id: string, body = 'facts:\n  within: 20\n', extra = ''): string =>
  [`id: ${id}`, 'title: Math Test', 'subject: math', extra, body].filter(Boolean).join('\n') + '\n';

const CHINESE_ITEM = '\n  - target: 找\n    clue: 找东西\n    pinyin: zhǎo\n';

describe('math lessons build', () => {
  it('builds a lesson with facts rules: in the manifest under the math subject, no script, no items', async () => {
    const ws = await createWorkspace({ 'math/m.yaml': mathLesson('m', 'facts:\n  within: 20\n', 'testDates: 2026-10-26 to 2026-10-30') });
    await ws.build();

    const manifest = await ws.manifest();
    expect(manifest.subjects).toEqual([
      {
        id: 'math',
        lessons: [
          {
            id: 'm',
            file: expect.stringMatching(/^lessons\/m\.[0-9a-f]{12}\.json$/),
            title: 'Math Test',
            testDates: '2026-10-26 to 2026-10-30',
            practiceTypes: [{ id: 'facts', itemCount: 20 }],
          },
        ],
      },
    ]);
    const lesson = await ws.lesson('m');
    expect(lesson).toEqual({
      id: 'm',
      title: 'Math Test',
      subject: 'math',
      testDates: '2026-10-26 to 2026-10-30',
      lists: {},
      rules: { facts: { within: 20, operations: ['add', 'subtract'] } },
    });
  });

  it('does no audio, pinyin or font work for math', async () => {
    const ws = await createWorkspace({ 'math/m.yaml': mathLesson('m') });
    const result = await ws.build();

    expect(ws.provider.requests).toEqual([]);
    expect(await ws.storedAudio()).toEqual([]);
    expect(await ws.outputAudio()).toEqual([]);
    expect(result.audio).toMatchObject({ needed: 0, requested: 0, placeholders: 0 });
    expect(result.warnings).toEqual([]);
  });

  it('defaults the rules to within 20 with add and subtract, and keeps what the lesson sets', async () => {
    const ws = await createWorkspace({
      'math/defaults.yaml': mathLesson('defaults', 'facts: {}'),
      'math/adding.yaml': mathLesson('adding', 'facts:\n  within: 100\n  operations: [add]\n'),
    });
    await ws.build();

    expect((await ws.lesson('defaults')).rules).toEqual({ facts: { within: 20, operations: ['add', 'subtract'] } });
    expect((await ws.lesson('adding')).rules).toEqual({ facts: { within: 100, operations: ['add'] } });
  });

  it('builds next to Chinese lessons, which keep their pinyin and audio and carry no rules', async () => {
    const ws = await createWorkspace({
      'chinese/c.yaml': lessonYaml('c', CHINESE_ITEM),
      'math/m.yaml': mathLesson('m'),
    });
    await ws.build();

    expect((await ws.manifest()).subjects.map((s) => s.id)).toEqual(['chinese', 'math']);
    const chinese = await ws.lesson('c');
    expect(chinese).not.toHaveProperty('rules');
    expect(chinese.lists.dictation![0]!.pinyin).toBe('zhǎo');
    expect(ws.provider.requests.length).toBeGreaterThan(0);
  });
});

describe('math lessons are validated', () => {
  it('rejects a math practice type in a Chinese lesson', async () => {
    const yaml = lessonYaml('x', CHINESE_ITEM) + 'facts:\n  within: 20\n';
    const message = await buildError(await createWorkspace({ 'chinese/x.yaml': yaml }));
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('[wrong-subject]');
    expect(message).toContain('"facts"');
  });

  it('rejects a Chinese practice type in a math lesson', async () => {
    const yaml = mathLesson('x') + 'dictation:' + CHINESE_ITEM;
    const message = await buildError(await createWorkspace({ 'math/x.yaml': yaml }));
    expect(message).toContain('math/x.yaml');
    expect(message).toContain('[wrong-subject]');
    expect(message).toContain('"dictation"');
  });

  it('rejects a math lesson without any practice type', async () => {
    const message = await buildError(await createWorkspace({ 'math/x.yaml': 'id: x\ntitle: T\nsubject: math\n' }));
    expect(message).toContain('math/x.yaml');
    expect(message).toContain('[no-lists]');
  });

  it('rejects a script on a math lesson', async () => {
    const message = await buildError(await createWorkspace({ 'math/x.yaml': mathLesson('x', undefined, 'script: simplified') }));
    expect(message).toContain('math/x.yaml');
    expect(message).toContain('[unknown-key]');
    expect(message).toContain('"script"');
  });

  it.each([
    ['within: 5', '"within"'],
    ['within: 150', '"within"'],
    ['within: 20.5', '"within"'],
    ['within: lots', '"within"'],
    ['operations: [multiply]', '"multiply"'],
    ['operations: []', '"operations"'],
    ['operations: add', '"operations"'],
    ['colour: red', '"colour"'],
  ])('rejects the rules "%s"', async (rule, mentioned) => {
    const message = await buildError(await createWorkspace({ 'math/x.yaml': mathLesson('x', `facts:\n  ${rule}\n`) }));
    expect(message).toContain('math/x.yaml');
    expect(message).toContain('facts');
    expect(message).toContain(mentioned);
  });

  it('rejects rules that are not a mapping', async () => {
    const message = await buildError(await createWorkspace({ 'math/x.yaml': mathLesson('x', 'facts:\n  - 1 + 2\n') }));
    expect(message).toContain('math/x.yaml');
    expect(message).toContain('facts');
    expect(message).toContain('[invalid-value]');
  });
});
