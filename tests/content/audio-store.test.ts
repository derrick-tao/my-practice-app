import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateAudio } from '../../content-build/build.ts';
import { createFakeProvider } from '../../content-build/tts/fake-provider.ts';
import type { TtsProvider } from '../../content-build/tts/types.ts';
import { buildError, createWorkspace, lessonYaml } from './harness.ts';

const TWO_ITEMS = `
  - target: 找
    clue: 找东西
    pinyin: zhǎo
  - target: 点
    clue: 几点
    pinyin: diǎn
`;

/** A real-looking provider that has no credentials. */
function credentialLessProvider(): TtsProvider & { calls: number } {
  const provider = {
    id: 'azure',
    extension: 'mp3',
    supportsPhonemes: true,
    calls: 0,
    unavailableReason: () => 'AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are not set',
    async synthesize(): Promise<Uint8Array> {
      provider.calls++;
      throw new Error('should never be called');
    },
  };
  return provider;
}

// Seam 2 scenario 6.
describe('content build: content-addressed audio', () => {
  it('changing one clue requests exactly two renditions (normal + slow) for that item', async () => {
    const ws = await createWorkspace({ 'chinese/t.yaml': lessonYaml('t', TWO_ITEMS) });
    await ws.build();
    expect(ws.provider.requests).toHaveLength(4);

    await ws.build();
    expect(ws.provider.requests).toHaveLength(4);

    await ws.writeLessons({ 'chinese/t.yaml': lessonYaml('t', TWO_ITEMS.replace('几点', '多少点')) });
    await ws.build();
    const fresh = ws.provider.requests.slice(4);
    expect(fresh.map((r) => [r.text, r.rate])).toEqual([
      ['点，多少点的点', '0%'],
      ['点，多少点的点', '-30%'],
    ]);
  });

  it('adding an item requests only the new item', async () => {
    const ws = await createWorkspace({ 'chinese/t.yaml': lessonYaml('t', TWO_ITEMS) });
    await ws.build();
    await ws.writeLessons({
      'chinese/t.yaml': lessonYaml('t', `${TWO_ITEMS}  - target: 车\n    clue: 汽车\n    pinyin: chē\n`),
    });
    await ws.build();
    expect(ws.provider.requests.slice(4).map((r) => r.text)).toEqual(['车，汽车的车', '车，汽车的车']);
  });

  it('asks once for a prompt that several items share', async () => {
    const ws = await createWorkspace({
      'chinese/a.yaml': lessonYaml('a', TWO_ITEMS),
      'chinese/b.yaml': lessonYaml('b', TWO_ITEMS),
    });
    await ws.build();
    expect(ws.provider.requests).toHaveLength(4);
  });

  it('keeps audio from a different provider separate (the provider is part of the file name)', async () => {
    const ws = await createWorkspace({ 'chinese/t.yaml': lessonYaml('t', TWO_ITEMS) });
    await ws.build();
    const other: TtsProvider = { ...createFakeProvider(), id: 'other' };
    await ws.build({ provider: other });
    expect(await ws.storedAudio()).toHaveLength(8);
  });
});

// Seam 2 scenario 7.
describe('content build: prune', () => {
  it('removes audio that no item references and keeps audio that is referenced', async () => {
    const ws = await createWorkspace({ 'chinese/t.yaml': lessonYaml('t', TWO_ITEMS) });
    await ws.build();
    const before = await ws.storedAudio();
    expect(before).toHaveLength(4);

    // Replace the second item: its old two files become unreferenced.
    await ws.writeLessons({
      'chinese/t.yaml': lessonYaml('t', TWO_ITEMS.replace('几点', '多少点')),
    });
    await ws.build({ prune: true });

    const after = await ws.storedAudio();
    expect(after).toHaveLength(4);
    const outputRefs = (await ws.outputAudio()).sort();
    expect(after).toEqual(outputRefs);
    expect(before.filter((name) => !after.includes(name))).toHaveLength(2);
  });

  it('does not remove anything unless asked to', async () => {
    const ws = await createWorkspace({ 'chinese/t.yaml': lessonYaml('t', TWO_ITEMS) });
    await ws.build();
    await ws.writeLessons({ 'chinese/t.yaml': lessonYaml('t', TWO_ITEMS.replace('几点', '多少点')) });
    await ws.build();
    expect(await ws.storedAudio()).toHaveLength(6);
  });

  it('only ever deletes audio files, never other files in the store', async () => {
    const ws = await createWorkspace({ 'chinese/t.yaml': lessonYaml('t', TWO_ITEMS) });
    await ws.build();
    await writeFile(path.join(ws.audioStoreDir, 'README.md'), 'keep me');
    await ws.build({ prune: true });
    expect(await ws.storedAudio()).toContain('README.md');
  });

  it('generateAudio with prune fills the store and prunes without writing site output', async () => {
    const ws = await createWorkspace({ 'chinese/t.yaml': lessonYaml('t', TWO_ITEMS) });
    const stats = await generateAudio({
      contentDir: ws.contentDir,
      audioStoreDir: ws.audioStoreDir,
      provider: ws.provider,
      prune: true,
    });
    expect(stats).toMatchObject({ needed: 4, requested: 4, pruned: [] });
    expect(await ws.storedAudio()).toHaveLength(4);
    await expect(readdir(ws.outDir)).rejects.toThrow();
  });
});

// Seam 2 scenario 8.
describe('content build: audio that cannot be generated', () => {
  it('fails with a clear message, before writing anything, when audio is missing and there are no credentials', async () => {
    const ws = await createWorkspace({ 'chinese/t.yaml': lessonYaml('t', TWO_ITEMS) });
    const provider = credentialLessProvider();
    const message = await buildError({ ...ws, build: () => ws.build({ provider }) });
    expect(message).toContain('4 audio file(s) are missing');
    expect(message).toContain('AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are not set');
    expect(message).toContain('--fake-audio');
    expect(provider.calls).toBe(0);
    await expect(readdir(ws.outDir)).rejects.toThrow();
  });

  it('needs no credentials when every file is already in the store', async () => {
    const ws = await createWorkspace({ 'chinese/t.yaml': lessonYaml('t', TWO_ITEMS) });
    const real: TtsProvider = { ...createFakeProvider(), id: 'azure' };
    await ws.build({ provider: real });
    const provider = { ...credentialLessProvider(), id: 'azure' };
    await ws.build({ provider });
    expect(provider.calls).toBe(0);
    expect(await ws.outputAudio()).toHaveLength(4);
  });

  it('uses silent placeholder audio only when explicitly opted in, and never writes it to the audio store', async () => {
    const ws = await createWorkspace({ 'chinese/t.yaml': lessonYaml('t', TWO_ITEMS) });
    const placeholderDir = await mkdtemp(path.join(tmpdir(), 'placeholder-'));
    const placeholder = createFakeProvider();
    await ws.build({
      provider: credentialLessProvider(),
      placeholder: { provider: placeholder, storeDir: placeholderDir },
    });
    expect(await ws.storedAudio()).toEqual([]);
    expect(await readdir(placeholderDir)).toHaveLength(4);
    expect(await ws.outputAudio()).toHaveLength(4);
    const lesson = await ws.lesson('t');
    expect(lesson.lists.dictation![0]!.audio.normal).toMatch(/^audio\/[0-9a-f]{32}\.mp3$/);
  });

  it('prefers real audio from the store over placeholders for items that have it', async () => {
    const ws = await createWorkspace({ 'chinese/t.yaml': lessonYaml('t', TWO_ITEMS) });
    const real: TtsProvider = { ...createFakeProvider(), id: 'azure' };
    await ws.build({ provider: real });
    const stored = await ws.storedAudio();

    await ws.writeLessons({ 'chinese/t.yaml': lessonYaml('t', `${TWO_ITEMS}  - target: 车\n    pinyin: chē\n`) });
    const placeholderDir = await mkdtemp(path.join(tmpdir(), 'placeholder-'));
    const placeholder = createFakeProvider();
    await ws.build({
      provider: { ...credentialLessProvider(), id: 'azure' },
      placeholder: { provider: placeholder, storeDir: placeholderDir },
    });
    expect(placeholder.requests.map((r) => r.text)).toEqual(['车', '车']);
    expect(await ws.storedAudio()).toEqual(stored);
    expect(await ws.outputAudio()).toHaveLength(6);
  });

  it('pruning while using placeholders never deletes real audio that is still referenced', async () => {
    const ws = await createWorkspace({ 'chinese/t.yaml': lessonYaml('t', TWO_ITEMS) });
    const real: TtsProvider = { ...createFakeProvider(), id: 'azure' };
    await ws.build({ provider: real });
    const stored = await ws.storedAudio();
    await ws.build({
      provider: { ...credentialLessProvider(), id: 'azure' },
      placeholder: { provider: createFakeProvider(), storeDir: await mkdtemp(path.join(tmpdir(), 'p-')) },
      prune: true,
    });
    expect(await ws.storedAudio()).toEqual(stored);
  });
});
