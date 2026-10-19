import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { convert } from 'fontverter';
import opentype from 'opentype.js';
import { describe, expect, it } from 'vitest';
import { createWorkspace, lessonYaml, type Workspace } from './harness.ts';

const FONT_FILE = 'fonts/practice-kai.woff2';

/** Which of `chars` the built font file has a glyph for (read from the finished build output). */
async function coveredBy(ws: Workspace, chars: string): Promise<{ covered: string[]; bytes: number }> {
  const woff2 = await readFile(path.join(ws.outDir, FONT_FILE));
  const sfnt = await convert(woff2, 'sfnt');
  const font = opentype.parse(sfnt.buffer.slice(sfnt.byteOffset, sfnt.byteOffset + sfnt.byteLength) as ArrayBuffer);
  return { covered: [...chars].filter((c) => font.charToGlyphIndex(c) > 0), bytes: woff2.length };
}

const ITEMS = `
  - target: 找
    clue: 找东西
  - target: 点
    clue: 几点
  - target: 什
    clue: 什么
`;

describe('content build: Kai font subset', () => {
  it('covers every character in the targets and clues, and nothing much more', async () => {
    const ws = await createWorkspace({ 'chinese/a.yaml': lessonYaml('a', ITEMS) });
    await ws.build();

    const inContent = [...new Set('找点什找东西几点什么')].join('');
    const { covered, bytes } = await coveredBy(ws, inContent);
    expect(covered.join('')).toBe(inContent);

    // Not the whole font: a character no lesson uses is left out, and the file stays tiny.
    const notUsed = await coveredBy(ws, '猫狗鸟');
    expect(notUsed.covered).toEqual([]);
    expect(bytes).toBeLessThan(20_000);
  });

  it('follows the content: a character added to a lesson is in the next build', async () => {
    const ws = await createWorkspace({ 'chinese/a.yaml': lessonYaml('a', ITEMS) });
    await ws.build();
    await ws.writeLessons({ 'chinese/a.yaml': lessonYaml('a', `${ITEMS}  - target: 猫\n`) });
    await ws.build();
    expect((await coveredBy(ws, '猫')).covered).toEqual(['猫']);
  });

  it('covers every character of the real published content', async () => {
    const real = await createWorkspace();
    await real.build({ contentDir: path.resolve('content') });
    const lessons = await Promise.all(
      (await real.manifest()).subjects.flatMap((s) => s.lessons.map((l) => real.lesson(l.id))),
    );
    const chars = [
      ...new Set(
        lessons.flatMap((l) =>
          Object.values(l.lists).flatMap((items) => items.flatMap((i) => [...i.target, ...(i.clue ?? '')])),
        ),
      ),
    ];
    const han = chars.filter((c) => /\p{Script=Han}/u.test(c)).join('');
    expect(han.length).toBeGreaterThan(30);
    expect((await coveredBy(real, han)).covered.join('')).toBe(han);
  });

  it('warns, without failing the build, about a target the source font has no glyph for', async () => {
    // U+20000 is a rare CJK Extension B character, outside the GB2312 source font.
    const ws = await createWorkspace({
      'chinese/a.yaml': lessonYaml('a', `${ITEMS}  - target: "\u{20000}"\n    pinyin: yī\n`),
    });
    const result = await ws.build();
    expect(result.warnings.filter((w) => w.includes('font'))).toEqual([expect.stringContaining('U+20000')]);
  });
});
