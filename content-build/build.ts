import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  listEntries,
  type ItemData,
  type LessonData,
  type LessonSummary,
  type Manifest,
} from '../src/content/types.ts';
import { formatIssue, validateAcrossFiles, validateLessonFile, type Issue, type SourceLesson } from './validate.ts';
import { itemPinyin } from './pinyin.ts';
import { resolveAudio, type AudioOptions, type AudioStats } from './audio.ts';
import { FONT_REF, buildFontSubset } from './font.ts';

export interface BuildOptions extends AudioOptions {
  /** Folder of lesson files, grouped by subject: `<contentDir>/<subject>/<lesson-id>.yaml`. */
  contentDir: string;
  /** Output folder (becomes `<site>/content/`): manifest.json, lessons/<id>.<hash>.json, audio/<hash>.<ext>. */
  outDir: string;
}

export interface BuildResult {
  contentVersion: string;
  warnings: string[];
  audio: AudioStats;
}

/** Validate the lessons, then make sure every item has its audio in the store (generating what is missing). */
export async function generateAudio(options: Omit<BuildOptions, 'outDir'>): Promise<AudioStats> {
  const { sources } = await loadAndValidate(options.contentDir);
  return (await resolveAudio(sources, options)).stats;
}

export async function buildContent(options: BuildOptions): Promise<BuildResult> {
  const { sources, warnings } = await loadAndValidate(options.contentDir);
  const resolved = await resolveAudio(sources, options);
  const audioFiles = new Map<string, string>();

  const lessons: LessonData[] = [];
  for (const [lessonIndex, raw] of sources.entries()) {
    const lists: LessonData['lists'] = {};
    for (const [type, sourceItems] of listEntries(raw.lists)) {
      const items: ItemData[] = [];
      for (const [itemIndex, item] of sourceItems.entries()) {
        const located = resolved.lessons[lessonIndex]![type]![itemIndex]!;
        audioFiles.set(located.normal.ref, located.normal.file);
        audioFiles.set(located.slow.ref, located.slow.file);
        items.push({
          target: item.target,
          ...(item.clue !== undefined && { clue: item.clue }),
          pinyin: itemPinyin(item),
          audio: { normal: located.normal.ref, slow: located.slow.ref },
        });
      }
      lists[type] = items;
    }
    lessons.push({
      id: raw.id,
      title: raw.title,
      subject: raw.subject,
      script: raw.script,
      ...(raw.testDates !== undefined && { testDates: raw.testDates }),
      lists,
    });
  }
  lessons.sort((a, b) => a.id.localeCompare(b.id));

  const contentVersion = hash(JSON.stringify(lessons)).slice(0, 12);
  // A lesson file is named by its content, so a name never refers to two versions of a lesson and the
  // service worker can cache lesson data forever; the (network-first) manifest says which file is current.
  const lessonFiles = new Map(
    lessons.map((lesson) => {
      const body = JSON.stringify(lesson, null, 2);
      return [lesson.id, { body, ref: `lessons/${lesson.id}.${hash(body).slice(0, 12)}.json` }] as const;
    }),
  );
  const manifest = buildManifest(lessons, contentVersion, (id) => lessonFiles.get(id)!.ref);

  await rm(options.outDir, { recursive: true, force: true });
  await mkdir(path.join(options.outDir, 'lessons'), { recursive: true });
  await mkdir(path.join(options.outDir, 'audio'), { recursive: true });
  for (const { body, ref } of lessonFiles.values()) await writeFile(path.join(options.outDir, ref), body);
  for (const [ref, file] of audioFiles) await copyFile(file, path.join(options.outDir, ref));
  await writeFile(path.join(options.outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const items = sources.flatMap((s) => listEntries(s.lists).flatMap(([, list]) => list));
  const font = await buildFontSubset(
    items.map((i) => i.target),
    items.flatMap((i) => (i.clue === undefined ? [] : [i.clue])),
  );
  await mkdir(path.join(options.outDir, path.dirname(FONT_REF)), { recursive: true });
  await writeFile(path.join(options.outDir, FONT_REF), font.woff2);

  return { contentVersion, warnings: [...warnings, ...font.warnings], audio: resolved.stats };
}

function buildManifest(lessons: LessonData[], contentVersion: string, fileOf: (lessonId: string) => string): Manifest {
  const subjects = new Map<string, LessonSummary[]>();
  for (const lesson of lessons) {
    const summaries = subjects.get(lesson.subject) ?? [];
    subjects.set(lesson.subject, summaries);
    summaries.push({
      id: lesson.id,
      file: fileOf(lesson.id),
      title: lesson.title,
      script: lesson.script,
      ...(lesson.testDates !== undefined && { testDates: lesson.testDates }),
      practiceTypes: listEntries(lesson.lists).map(([id, items]) => ({ id, itemCount: items.length })),
    });
  }
  return {
    contentVersion,
    subjects: [...subjects.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, list]) => ({ id, lessons: list })),
  };
}

export class ContentBuildError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Content validation failed with ${issues.length} problem(s):\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'ContentBuildError';
  }
}

/** Validate every lesson file; throws ContentBuildError (naming file, item and rule) on any error. */
export async function loadAndValidate(
  contentDir: string,
): Promise<{ sources: SourceLesson[]; warnings: string[] }> {
  const entries = (await readdir(contentDir, { recursive: true })).filter((e) => e.endsWith('.yaml')).sort();
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const parsed: Array<{ file: string; lesson: SourceLesson }> = [];
  for (const entry of entries) {
    const file = entry.split(path.sep).join('/');
    const result = validateLessonFile(file, await readFile(path.join(contentDir, entry), 'utf8'));
    errors.push(...result.errors);
    warnings.push(...result.warnings);
    if (result.lesson) parsed.push({ file, lesson: result.lesson });
  }
  errors.push(...validateAcrossFiles(parsed));
  if (errors.length > 0) throw new ContentBuildError(errors.map(formatIssue));
  return { sources: parsed.map((p) => p.lesson), warnings: warnings.map(formatIssue) };
}

function hash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
