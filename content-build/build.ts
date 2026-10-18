import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ttsConfig as defaultTtsConfig } from '../tts.config.ts';
import type { ItemData, ListData, ListSummary, Manifest } from '../src/content/types.ts';
import { formatIssue, validateAcrossFiles, validateListFile, type Issue, type SourceList } from './validate.ts';
import { generatePinyin } from './pinyin.ts';
import { buildSsml, spokenPrompt } from './tts/prompt.ts';
import type { TtsConfig } from './tts/config.ts';
import type { TtsProvider } from './tts/types.ts';

export interface BuildOptions {
  /** Folder of list files, grouped by subject: `<contentDir>/<subject>/<list-id>.yaml`. */
  contentDir: string;
  /** Output folder (becomes `<site>/content/`): manifest.json, lists/<id>.json, audio/<hash>.<ext>. */
  outDir: string;
  /** Content-addressed audio store. Real audio is committed here (ticket 02). */
  audioStoreDir: string;
  provider: TtsProvider;
  tts?: TtsConfig;
}

export interface BuildResult {
  contentVersion: string;
  warnings: string[];
}

export async function buildContent(options: BuildOptions): Promise<BuildResult> {
  const tts = options.tts ?? defaultTtsConfig;
  const { sources, warnings } = await loadAndValidate(options.contentDir);

  const lists: ListData[] = [];
  for (const raw of sources) {
    const items: ItemData[] = [];
    for (const item of raw.items) {
      const prompt = spokenPrompt(item);
      const audio = {
        normal: await ensureAudio(options, tts, prompt, tts.rates.normal),
        slow: await ensureAudio(options, tts, prompt, tts.rates.slow),
      };
      items.push({
        target: item.target,
        ...(item.clue !== undefined && { clue: item.clue }),
        pinyin: item.pinyin ?? generatePinyin(item.target),
        ...(item.lesson !== undefined && { lesson: item.lesson }),
        audio,
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
    for (const item of list.items) {
      for (const ref of [item.audio.normal, item.audio.slow]) {
        await copyFile(path.join(options.audioStoreDir, path.basename(ref)), path.join(options.outDir, ref));
      }
    }
  }
  await writeFile(path.join(options.outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  return { contentVersion, warnings };
}

async function ensureAudio(
  options: BuildOptions,
  tts: TtsConfig,
  text: string,
  rate: string,
): Promise<string> {
  const { provider } = options;
  const ssml = buildSsml(text, tts, rate);
  const name = `${hash(JSON.stringify([provider.id, tts.voice, rate, ssml])).slice(0, 32)}.${provider.extension}`;
  const stored = path.join(options.audioStoreDir, name);
  if (!(await exists(stored))) {
    const bytes = await provider.synthesize({ text, ssml, voice: tts.voice, rate, format: tts.format });
    await mkdir(options.audioStoreDir, { recursive: true });
    await writeFile(stored, bytes);
  }
  return `audio/${name}`;
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

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

function hash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
