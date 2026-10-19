// Seam 2 harness: run the content build end-to-end on fixture lesson files with the fake TTS provider.
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildContent, type BuildOptions, type BuildResult } from '../../content-build/build.ts';
import { createFakeProvider, type FakeProvider } from '../../content-build/tts/fake-provider.ts';
import type { LessonData, Manifest } from '../../src/content/types.ts';

export interface Workspace {
  contentDir: string;
  outDir: string;
  audioStoreDir: string;
  provider: FakeProvider;
  /** Write (or overwrite) lesson files relative to the content dir, e.g. `chinese/my-lesson.yaml`. */
  writeLessons(files: Record<string, string>): Promise<void>;
  /** Build with the workspace's fake provider; pass overrides to swap provider, prune, etc. */
  build(overrides?: Partial<BuildOptions>): Promise<BuildResult>;
  /**
   * Build the way production does: the provider is the one `tts` (default tts.config.ts) selects.
   * Stub credentials, network and clock through `providerDeps`.
   */
  buildConfigured(options?: Partial<Omit<BuildOptions, 'provider'>>): Promise<BuildResult>;
  /** File names in the audio store (the committed `audio/` folder in real life). */
  storedAudio(): Promise<string[]>;
  manifest(): Promise<Manifest>;
  lesson(id: string): Promise<LessonData>;
  /** File names in the output audio folder. */
  outputAudio(): Promise<string[]>;
}

export async function createWorkspace(files: Record<string, string> = {}): Promise<Workspace> {
  const root = await mkdtemp(path.join(tmpdir(), 'content-seam-'));
  const contentDir = path.join(root, 'content');
  const outDir = path.join(root, 'out');
  const audioStoreDir = path.join(root, 'audio-store');
  const provider = createFakeProvider();

  const writeLessons = async (lessons: Record<string, string>): Promise<void> => {
    for (const [relative, text] of Object.entries(lessons)) {
      const full = path.join(contentDir, relative);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, text, 'utf8');
    }
  };
  await mkdir(contentDir, { recursive: true });
  await writeLessons(files);

  return {
    contentDir,
    outDir,
    audioStoreDir,
    provider,
    writeLessons,
    build: (overrides) => buildContent({ contentDir, outDir, audioStoreDir, provider, ...overrides }),
    buildConfigured: (options) => buildContent({ contentDir, outDir, audioStoreDir, ...options }),
    storedAudio: async () => {
      try {
        return (await readdir(audioStoreDir)).sort();
      } catch {
        return [];
      }
    },
    manifest: async () =>
      JSON.parse(await readFile(path.join(outDir, 'manifest.json'), 'utf8')) as Manifest,
    lesson: async (id) => {
      const manifest = JSON.parse(await readFile(path.join(outDir, 'manifest.json'), 'utf8')) as Manifest;
      const summary = manifest.subjects.flatMap((s) => s.lessons).find((l) => l.id === id);
      if (!summary) throw new Error(`lesson ${id} is not in the manifest`);
      return JSON.parse(await readFile(path.join(outDir, summary.file), 'utf8')) as LessonData;
    },
    outputAudio: async () => {
      try {
        return (await readdir(path.join(outDir, 'audio'))).sort();
      } catch {
        return [];
      }
    },
  };
}

/** The lesson fields every lesson file starts with (no lists). `raw` lines are added after them. */
export function lessonHeader(
  id: string,
  extra: { title?: string; script?: string; testDates?: string; raw?: string } = {},
): string[] {
  const lines = [
    `id: ${id}`,
    `title: ${extra.title ?? 'Test Lesson'}`,
    'subject: chinese',
    `script: ${extra.script ?? 'simplified'}`,
  ];
  if (extra.testDates) lines.push(`testDates: ${extra.testDates}`);
  if (extra.raw) lines.push(extra.raw);
  return lines;
}

/** Build a minimal valid lesson YAML with one `dictation:` list; `raw` lines are added to the lesson's top level. */
export function lessonYaml(
  id: string,
  dictationItems: string,
  extra: { title?: string; script?: string; testDates?: string; raw?: string } = {},
): string {
  return [...lessonHeader(id, extra), 'dictation:', dictationItems].join('\n') + '\n';
}

/** Build and return the error message of the rejection (fails the test if the build succeeds). */
export async function buildError(ws: Workspace): Promise<string> {
  try {
    await ws.build();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('expected the build to fail, but it succeeded');
}
