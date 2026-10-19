import { describe, expect, it } from 'vitest';
import { buildError, createWorkspace, lessonHeader, lessonYaml } from './harness.ts';

const GOOD_ITEM = '\n  - target: 找\n    clue: 找东西\n    pinyin: zhǎo\n';

/** Build a one-lesson workspace, expect failure, return the message. */
async function failureFor(file: string, yaml: string): Promise<string> {
  return buildError(await createWorkspace({ [file]: yaml }));
}

describe('content validation: a valid fixture passes', () => {
  it('builds without errors or warnings', async () => {
    const ws = await createWorkspace({ 'chinese/good.yaml': lessonYaml('good', GOOD_ITEM) });
    const result = await ws.build();
    expect(result.warnings).toEqual([]);
  });
});

describe('content validation: every rule fails with file, item and rule', () => {
  it('rejects a missing required lesson field', async () => {
    const yaml = lessonYaml('x', GOOD_ITEM).replace('title: Test Lesson\n', '');
    const message = await failureFor('chinese/x.yaml', yaml);
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('[required-field]');
    expect(message).toContain('"title"');
  });

  it('rejects a missing target', async () => {
    const message = await failureFor('chinese/x.yaml', lessonYaml('x', '\n  - clue: 找东西\n'));
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('dictation item 1');
    expect(message).toContain('[required-field]');
    expect(message).toContain('"target"');
  });

  it('rejects an unknown lesson key', async () => {
    const message = await failureFor('chinese/x.yaml', lessonYaml('x', GOOD_ITEM, { raw: 'colour: red' }));
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('[unknown-key]');
    expect(message).toContain('"colour"');
  });

  it('rejects an unknown item key', async () => {
    const message = await failureFor(
      'chinese/x.yaml',
      lessonYaml('x', '\n  - target: 找\n    clue: 找东西\n    pinyn: zhǎo\n'),
    );
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('dictation item 1 (找)');
    expect(message).toContain('[unknown-key]');
    expect(message).toContain('"pinyn"');
  });

  it('rejects a lesson id that does not match the file name', async () => {
    const message = await failureFor('chinese/actual-name.yaml', lessonYaml('other-name', GOOD_ITEM));
    expect(message).toContain('chinese/actual-name.yaml');
    expect(message).toContain('[id-matches-filename]');
    expect(message).toContain('other-name');
  });

  it('rejects an id used by another lesson', async () => {
    // Same id in two subject folders; each file name matches its id.
    const ws = await createWorkspace({
      'chinese/dup.yaml': lessonYaml('dup', GOOD_ITEM),
      'chinese/more/dup.yaml': lessonYaml('dup', GOOD_ITEM),
    });
    const message = await buildError(ws);
    expect(message).toContain('[id-unique]');
    expect(message).toContain('chinese/more/dup.yaml');
    expect(message).toContain('chinese/dup.yaml');
  });

  it('rejects an empty target', async () => {
    const message = await failureFor('chinese/x.yaml', lessonYaml('x', '\n  - target: ""\n'));
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('dictation item 1');
    expect(message).toContain('[target-empty]');
  });

  it('rejects a duplicated target', async () => {
    const message = await failureFor(
      'chinese/x.yaml',
      lessonYaml('x', `${GOOD_ITEM}  - target: 找\n    clue: 找人\n`),
    );
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('dictation item 2 (找)');
    expect(message).toContain('[target-duplicate]');
    expect(message).toContain('repeats item 1');
  });

  it('rejects a non-CJK target in a Chinese lesson', async () => {
    const message = await failureFor('chinese/x.yaml', lessonYaml('x', '\n  - target: A\n'));
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('dictation item 1 (A)');
    expect(message).toContain('[target-cjk]');
  });

  it('rejects a clue that does not contain its target', async () => {
    const message = await failureFor('chinese/x.yaml', lessonYaml('x', '\n  - target: 找\n    clue: 东西\n'));
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('dictation item 1 (找)');
    expect(message).toContain('[clue-contains-target]');
  });

  it.each([
    ['digits instead of tone marks', 'zhao3'],
    ['non-letters', 'zh@o'],
    ['an empty string', '""'],
  ])('rejects malformed pinyin: %s', async (_name, pinyin) => {
    const message = await failureFor(
      'chinese/x.yaml',
      lessonYaml('x', `\n  - target: 找\n    clue: 找东西\n    pinyin: ${pinyin}\n`),
    );
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('dictation item 1 (找)');
    expect(message).toContain('[pinyin-format]');
  });

  it('rejects pinyin whose syllable count does not match the target length', async () => {
    const message = await failureFor(
      'chinese/x.yaml',
      lessonYaml('x', '\n  - target: 作业\n    clue: 作业本\n    pinyin: zuò\n'),
    );
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('dictation item 1 (作业)');
    expect(message).toContain('[pinyin-syllable-count]');
  });

  it('accepts multi-syllable pinyin with tone marks, ü and neutral tone', async () => {
    const ws = await createWorkspace({
      'chinese/ok.yaml': lessonYaml(
        'ok',
        '\n  - target: 女儿\n    clue: 女儿\n    pinyin: nǚ er\n  - target: 什么\n    clue: 什么\n    pinyin: shén me\n',
      ),
    });
    await expect(ws.build()).resolves.toBeDefined();
  });

  it('rejects an unsupported script', async () => {
    const script = await failureFor('chinese/x.yaml', lessonYaml('x', GOOD_ITEM, { script: 'klingon' }));
    expect(script).toContain('[invalid-value]');
    expect(script).toContain('"script"');
  });

  it('rejects an unknown practice-type key, naming file, practice type and rule', async () => {
    const message = await failureFor(
      'chinese/x.yaml',
      lessonYaml('x', GOOD_ITEM, { raw: 'karaoke:\n  - target: 找' }),
    );
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('karaoke');
    expect(message).toContain('[unknown-key]');
  });

  it('rejects a lesson with no lists', async () => {
    const message = await failureFor('chinese/x.yaml', lessonHeader('x').join('\n') + '\n');
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('[no-lists]');
    expect(message).toContain('dictation');
  });

  it('rejects an empty list, naming the practice type', async () => {
    const message = await failureFor(
      'chinese/x.yaml',
      lessonYaml('x', '').replace('dictation:\n', 'dictation: []\n'),
    );
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('dictation');
    expect(message).toContain('[empty-list]');
  });

  it('rejects the old format keys practiceTypes and items as unknown keys', async () => {
    const practiceTypes = await failureFor(
      'chinese/x.yaml',
      lessonYaml('x', GOOD_ITEM, { raw: 'practiceTypes: [dictation]' }),
    );
    expect(practiceTypes).toContain('chinese/x.yaml');
    expect(practiceTypes).toContain('[unknown-key]');
    expect(practiceTypes).toContain('"practiceTypes"');

    const items = await failureFor('chinese/x.yaml', lessonYaml('x', GOOD_ITEM, { raw: 'items:\n  - target: 找' }));
    expect(items).toContain('chinese/x.yaml');
    expect(items).toContain('[unknown-key]');
    expect(items).toContain('"items"');
  });

  it('rejects the old item-level lesson tag as an unknown key', async () => {
    const message = await failureFor(
      'chinese/x.yaml',
      lessonYaml('x', '\n  - target: 找\n    clue: 找东西\n    lesson: L1\n'),
    );
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('dictation item 1 (找)');
    expect(message).toContain('[unknown-key]');
    expect(message).toContain('"lesson"');
  });

  it('rejects YAML that cannot be parsed, naming the file', async () => {
    const message = await failureFor('chinese/x.yaml', 'id: [unclosed\n');
    expect(message).toContain('chinese/x.yaml');
    expect(message).toContain('[yaml-syntax]');
  });

  it('reports every problem across files in one run', async () => {
    const ws = await createWorkspace({
      'chinese/a.yaml': lessonYaml('a', '\n  - target: A\n'),
      'chinese/b.yaml': lessonYaml('b', '\n  - target: 找\n    clue: 东西\n'),
    });
    const message = await buildError(ws);
    expect(message).toContain('chinese/a.yaml');
    expect(message).toContain('[target-cjk]');
    expect(message).toContain('chinese/b.yaml');
    expect(message).toContain('[clue-contains-target]');
  });

  it('writes no output when validation fails', async () => {
    const ws = await createWorkspace({ 'chinese/a.yaml': lessonYaml('a', '\n  - target: A\n') });
    await buildError(ws);
    expect(await ws.outputAudio()).toEqual([]);
    expect(ws.provider.requests).toEqual([]);
  });
});

describe('content validation: script mismatch is only a warning', () => {
  it('warns when a simplified lesson contains traditional characters', async () => {
    const ws = await createWorkspace({
      'chinese/x.yaml': lessonYaml('x', '\n  - target: 點\n    clue: 幾點\n    pinyin: diǎn\n'),
    });
    const result = await ws.build();
    // 點 is traditional, which the simplified Kai font does not carry: that is a separate font warning.
    const mismatches = result.warnings.filter((warning) => warning.includes('[script-mismatch]'));
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toContain('chinese/x.yaml');
    expect(mismatches[0]).toContain('dictation item 1 (點)');
  });

  it('warns when a traditional lesson contains simplified characters', async () => {
    const ws = await createWorkspace({
      'chinese/x.yaml': lessonYaml('x', '\n  - target: 点\n    clue: 几点\n    pinyin: diǎn\n', {
        script: 'traditional',
      }),
    });
    const result = await ws.build();
    expect(result.warnings.join('\n')).toContain('[script-mismatch]');
  });

  it('does not warn for characters shared by both scripts', async () => {
    const ws = await createWorkspace({
      'chinese/x.yaml': lessonYaml('x', '\n  - target: 人\n    clue: 大人\n    pinyin: rén\n', {
        script: 'traditional',
      }),
    });
    expect((await ws.build()).warnings).toEqual([]);
  });
});
