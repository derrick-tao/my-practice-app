// Seam 2 harness: run the content build end-to-end on fixture list files with the fake TTS provider.
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildContent, type BuildResult } from '../../content-build/build.ts';
import { createFakeProvider, type FakeProvider } from '../../content-build/tts/fake-provider.ts';
import type { ListData, Manifest } from '../../src/content/types.ts';

export interface Workspace {
  contentDir: string;
  outDir: string;
  audioStoreDir: string;
  provider: FakeProvider;
  /** Write (or overwrite) list files relative to the content dir, e.g. `chinese/my-list.yaml`. */
  writeLists(files: Record<string, string>): Promise<void>;
  build(): Promise<BuildResult>;
  manifest(): Promise<Manifest>;
  list(id: string): Promise<ListData>;
  /** File names in the output audio folder. */
  outputAudio(): Promise<string[]>;
}

export async function createWorkspace(files: Record<string, string> = {}): Promise<Workspace> {
  const root = await mkdtemp(path.join(tmpdir(), 'content-seam-'));
  const contentDir = path.join(root, 'content');
  const outDir = path.join(root, 'out');
  const audioStoreDir = path.join(root, 'audio-store');
  const provider = createFakeProvider();

  const writeLists = async (lists: Record<string, string>): Promise<void> => {
    for (const [relative, text] of Object.entries(lists)) {
      const full = path.join(contentDir, relative);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, text, 'utf8');
    }
  };
  await mkdir(contentDir, { recursive: true });
  await writeLists(files);

  return {
    contentDir,
    outDir,
    audioStoreDir,
    provider,
    writeLists,
    build: () => buildContent({ contentDir, outDir, audioStoreDir, provider }),
    manifest: async () =>
      JSON.parse(await readFile(path.join(outDir, 'manifest.json'), 'utf8')) as Manifest,
    list: async (id) =>
      JSON.parse(await readFile(path.join(outDir, 'lists', `${id}.json`), 'utf8')) as ListData,
    outputAudio: async () => {
      try {
        return (await readdir(path.join(outDir, 'audio'))).sort();
      } catch {
        return [];
      }
    },
  };
}

/** Build a minimal valid list YAML; pass `overrides` lines to replace/add top-level fields. */
export function listYaml(
  id: string,
  items: string,
  extra: { title?: string; script?: string; testDates?: string; raw?: string } = {},
): string {
  const lines = [
    `id: ${id}`,
    `title: ${extra.title ?? 'Test List'}`,
    'subject: chinese',
    'practiceTypes: [dictation]',
    `script: ${extra.script ?? 'simplified'}`,
  ];
  if (extra.testDates) lines.push(`testDates: ${extra.testDates}`);
  if (extra.raw) lines.push(extra.raw);
  lines.push('items:', items);
  return lines.join('\n') + '\n';
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
