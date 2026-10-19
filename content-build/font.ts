// Kai-style handwriting font for the revealed character, cut down at build time to only the characters
// the content uses (a few KB instead of megabytes), so the app serves it itself: no font CDN, and the
// service worker can precache it for offline use.
//
// The source is LXGW WenKai (SIL OFL 1.1), GB2312 character set, committed in `content-build/fonts/` with
// its license; see the README there. Nothing is downloaded at build time.
import { readFile } from 'node:fs/promises';
import subsetFont from 'subset-font';
import { convert } from 'fontverter';
import opentype from 'opentype.js';

/** Where the subset lands, relative to the content root (`<base>content/`). */
export const FONT_REF = 'fonts/practice-kai.woff2';

const SOURCE_FONT = new URL('./fonts/lxgw-wenkai-gb2312.woff2', import.meta.url);

export interface FontSubset {
  woff2: Uint8Array;
  /** Warnings about characters the source font has no glyph for (they fall back to the system font). */
  warnings: string[];
}

/** Characters shown in the Kai font (targets) plus the clues next to them, without repeats or whitespace. */
export function fontCharacters(texts: Iterable<string>): string {
  const chars = new Set<string>();
  for (const text of texts) for (const char of text) if (/\S/u.test(char)) chars.add(char);
  return [...chars].join('');
}

export async function buildFontSubset(targets: readonly string[], clues: readonly string[]): Promise<FontSubset> {
  const source = await readFile(SOURCE_FONT);
  const sfnt = await convert(source, 'sfnt');
  const font = opentype.parse(sfnt.buffer.slice(sfnt.byteOffset, sfnt.byteOffset + sfnt.byteLength) as ArrayBuffer);

  const warnings = [...fontCharacters(targets)]
    .filter((char) => font.charToGlyphIndex(char) === 0)
    .map(
      (char) =>
        `font: U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')} (${char}) is not in the ` +
        'Kai font; it will show in the system font',
    );

  const woff2 = await subsetFont(source, fontCharacters([...targets, ...clues]), { targetFormat: 'woff2' });
  return { woff2, warnings };
}
