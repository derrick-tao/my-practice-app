import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ttsConfig as defaultTtsConfig } from '../tts.config.ts';
import type { ItemData, ListData, ListSummary, Manifest } from '../src/content/types.ts';
import { formatIssue, validateAcrossFiles, validateListFile, type Issue, type SourceList } from './validate.ts';
import { itemPinyin } from './pinyin.ts';
import { resolveAudio, type AudioOptions, type AudioStats } from './audio.ts';
import type { TtsConfig } from './tts/config.ts';
import type { TtsProvider } from './tts/types.ts';

export interface BuildOptions {
  /** Folder of list files, grouped by subject: `<contentDir>/<subject>/<list-id>.yaml`. */
  contentDir: string;
  /** Output folder (becomes `<site>/content/`): manifest.json, lists/<id>.json, audio/<hash>.<ext>. */
  outDir: string;
  /** Content-addressed audio store. Real audio is committed here. */
  audioStoreDir: string;
  provider: TtsProvider;
  tts?: TtsConfig;
  /** Opt-in silent placeholder audio for anything missing from the store (see AudioOptions). */
  placeholder?: AudioOptions['placeholder'];
  /** Remove store audio that no item references. */
  prune?: boolean;
  log?: (line: string) => void;
}

export interface BuildResult {
  contentVersion: string;
  warnings: string[];
  audio: AudioStats;
}

function audioOptions(options: Omit<BuildOptions, 'outDir'>): AudioOptions {
  return {
    audioStoreDir: options.audioStoreDir,
    provider: options.provider,
    tts: options.tts ?? defaultTtsConfig,
    ...(options.placeholder && { placeholder: options.placeholder }),
    ...(options.prune !== undefined && { prune: options.prune }),
    ...(options.log && { log: options.log }),
  };
}

/** Validate the lists, then make sure every item has its audio in the store (generating what is missing). */
export async function generateAudio(options: Omit<BuildOptions, 'outDir'>): Promise<AudioStats> {
  const { sources } = await loadAndValidate(options.contentDir);
  return (await resolveAudio(sources, audioOptions(options))).stats;
}

export async function buildContent(options: BuildOptions): Promise<BuildResult> {
  const { sources, warnings } = await loadAndValidate(options.contentDir);
  const resolved = await resolveAudio(sources, audioOptions(options));
  const audioFiles = new Map<string, string>();

  const lists: ListData[] = [];
  for (const [listIndex, raw] of sources.entries()) {
    const items: ItemData[] = [];
    for (const [itemIndex, item] of raw.items.entries()) {
      const located = resolved.lists[listIndex]![itemIndex]!;
      audioFiles.set(located.normal.ref, located.normal.file);
      audioFiles.set(located.slow.ref, located.slow.file);
      items.push({
        target: item.target,
        ...(item.clue !== undefined && { clue: item.clue }),
        pinyin: itemPinyin(item),
        ...(item.lesson !== undefined && { lesson: item.lesson }),
        audio: { normal: located.normal.ref, slow: located.slow.ref },
      });
    }
    lists.push({
      id: raw.id,
      title: raw.title,
      subject: raw.subject,
      practiceTypes: raw.practiceTypes,
      script: raw.script,
      ...(raw.testDates !== undefined && { testDates: raw.testDates }),
      items,
    });
  }
  lists.sort((a, b) => a.id.localeCompare(b.id));

  const contentVersion = hash(JSON.stringify(lists)).slice(0, 12);
  const manifest = buildManifest(lists, contentVersion);

  await rm(options.outDir, { recursive: true, force: true });
  await mkdir(path.join(options.outDir, 'lists'), { recursive: true });
  await mkdir(path.join(options.outDir, 'audio'), { recursive: true });
  for (const list of lists) {
    await writeFile(path.join(options.outDir, 'lists', `${list.id}.json`), JSON.stringify(list, null, 2));
  }
  for (const [ref, file] of audioFiles) await copyFile(file, path.join(options.outDir, ref));
  await writeFile(path.join(options.outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  return { contentVersion, warnings, audio: resolved.stats };
}

function buildManifest(lists: ListData[], contentVersion: string): Manifest {
  const subjects = new Map<string, Map<string, ListSummary[]>>();
  for (const list of lists) {
    const types = subjects.get(list.subject) ?? new Map<string, ListSummary[]>();
    subjects.set(list.subject, types);
    for (const type of list.practiceTypes) {
      const summaries = types.get(type) ?? [];
      types.set(type, summaries);
      summaries.push({
        id: list.id,
        title: list.title,
        script: list.script,
        ...(list.testDates !== undefined && { testDates: list.testDates }),
        itemCount: list.items.length,
      });
    }
  }
  return {
    contentVersion,
    subjects: [...subjects.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, types]) => ({
        id,
        practiceTypes: [...types.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([typeId, summaries]) => ({ id: typeId as 'dictation', lists: summaries })),
      })),
  };
}

export class ContentBuildError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Content validation failed with ${issues.length} problem(s):\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'ContentBuildError';
  }
}

/** Validate every list file; throws ContentBuildError (naming file, item and rule) on any error. */
export async function loadAndValidate(
  contentDir: string,
): Promise<{ sources: SourceList[]; warnings: string[] }> {
  const entries = (await readdir(contentDir, { recursive: true })).filter((e) => e.endsWith('.yaml')).sort();
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const parsed: Array<{ file: string; list: SourceList }> = [];
  for (const entry of entries) {
    const file = entry.split(path.sep).join('/');
    const result = validateListFile(file, await readFile(path.join(contentDir, entry), 'utf8'));
    errors.push(...result.errors);
    warnings.push(...result.warnings);
    if (result.list) parsed.push({ file, list: result.list });
  }
  errors.push(...validateAcrossFiles(parsed));
  if (errors.length > 0) throw new ContentBuildError(errors.map(formatIssue));
  return { sources: parsed.map((p) => p.list), warnings: warnings.map(formatIssue) };
}

function hash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
