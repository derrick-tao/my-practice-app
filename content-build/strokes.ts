// Stroke data for the stroke order practice type: one file per distinct character, named by content hash like
// audio, written from `hanzi-writer-data` (Arphic Public License, from Make Me a Hanzi). The package is read
// here at build time only; the app serves the files itself and never reaches for the library's CDN.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { listEntries } from '../src/content/types.ts';
import type { Issue, SourceLesson } from './validate.ts';

const DATA_DIR = path.dirname(createRequire(import.meta.url).resolve('hanzi-writer-data/package.json'));

/** A character's stroke file: `ref` is relative to the content root, `body` is the file's text. */
export interface StrokeFile {
  ref: string;
  body: string;
}

/** The stroke data for one character, or undefined when the package has none. */
async function readStrokeData(char: string): Promise<string | undefined> {
  try {
    return await readFile(path.join(DATA_DIR, `${char}.json`), 'utf8');
  } catch {
    return undefined;
  }
}

/** Every distinct character in the lessons' stroke-order lists, with its stroke file; characters without data are reported as issues. */
export async function resolveStrokes(
  sources: ReadonlyArray<{ file: string; lesson: SourceLesson }>,
): Promise<{ files: Map<string, StrokeFile>; issues: Issue[] }> {
  const files = new Map<string, StrokeFile>();
  const missing = new Set<string>();
  const issues: Issue[] = [];
  for (const { file, lesson } of sources) {
    for (const [type, items] of listEntries(lesson.lists)) {
      if (type !== 'stroke-order') continue;
      for (const [index, item] of items.entries()) {
        if (files.has(item.target) || missing.has(`${file}\0${item.target}`)) continue;
        const body = await readStrokeData(item.target);
        if (body === undefined) {
          missing.add(`${file}\0${item.target}`);
          issues.push({
            file,
            practiceType: type,
            itemNumber: index + 1,
            target: item.target,
            rule: 'stroke-data-missing',
            message: `there is no stroke data for ${item.target} (U+${item.target.codePointAt(0)!.toString(16).toUpperCase()}), so it cannot be drawn`,
          });
          continue;
        }
        const digest = createHash('sha256').update(body).digest('hex').slice(0, 12);
        files.set(item.target, { ref: `strokes/${digest}.json`, body });
      }
    }
  }
  return { files, issues };
}
