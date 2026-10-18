import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { createWorkspace, listYaml, type Workspace } from './harness.ts';

const run = promisify(execFile);
const CLI = path.resolve('content-build/cli.ts');

// The CLI runs in a clean environment: whatever credentials or FAKE_AUDIO the developer's shell (or
// pull-request CI) has must not change what these tests mean, and nothing here may reach the network.
const CLEAN_ENV = { ...process.env, AZURE_SPEECH_KEY: '', AZURE_SPEECH_REGION: '', FAKE_AUDIO: '' };

async function cli(args: string[], env: Record<string, string> = {}) {
  try {
    const { stdout, stderr } = await run('npx', ['tsx', CLI, ...args], {
      encoding: 'utf8',
      env: { ...CLEAN_ENV, ...env },
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const e = error as { code: number; stdout: string; stderr: string };
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}

async function buildArgs(ws: Workspace, extra: string[] = []): Promise<string[]> {
  return [
    'build',
    '--content', ws.contentDir,
    '--out', ws.outDir,
    '--audio-store', ws.audioStoreDir,
    '--fake-audio-store', await mkdtemp(path.join(tmpdir(), 'fake-store-')),
    ...extra,
  ];
}

const OK_LIST = { 'chinese/ok.yaml': listYaml('ok', '\n  - target: 找\n    clue: 找东西\n') };

// These are what CI runs (`npm run validate`, `npm run content:build`), so exit codes matter.
describe('content CLI', () => {
  it('validate exits non-zero and names file, item and rule for an invalid list', async () => {
    const ws = await createWorkspace({
      'chinese/bad.yaml': listYaml('bad', '\n  - target: 找\n    clue: 东西\n'),
    });
    const result = await cli(['validate', '--content', ws.contentDir]);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('chinese/bad.yaml');
    expect(result.stderr).toContain('item 1 (找)');
    expect(result.stderr).toContain('[clue-contains-target]');
  });

  it('validate exits zero for valid content and requests no audio', async () => {
    const ws = await createWorkspace(OK_LIST);
    const result = await cli(['validate', '--content', ws.contentDir]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('1 list');
  });

  it('build with --fake-audio writes the manifest and does not write output when invalid', async () => {
    const good = await createWorkspace(OK_LIST);
    const ok = await cli(await buildArgs(good, ['--fake-audio']));
    expect(ok.code).toBe(0);
    await expect(access(path.join(good.outDir, 'manifest.json'))).resolves.toBeUndefined();

    const bad = await createWorkspace({ 'chinese/x.yaml': listYaml('x', '\n  - target: A\n') });
    const failed = await cli(await buildArgs(bad, ['--fake-audio']));
    expect(failed.code).not.toBe(0);
    await expect(access(path.join(bad.outDir, 'manifest.json'))).rejects.toThrow();
  });
});

describe('content CLI: audio and credentials', () => {
  it('build that needs audio, with no credentials and no fake flag, fails clearly and writes nothing', async () => {
    const ws = await createWorkspace(OK_LIST);
    const result = await cli(await buildArgs(ws));
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('2 audio file(s) are missing');
    expect(result.stderr).toContain('AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must both be set');
    expect(result.stderr).toContain('--fake-audio');
    await expect(access(path.join(ws.outDir, 'manifest.json'))).rejects.toThrow();
    expect(await ws.storedAudio()).toEqual([]);
  });

  it('FAKE_AUDIO=1 is the same explicit opt-in as --fake-audio, and its audio is never put in the audio store', async () => {
    const ws = await createWorkspace(OK_LIST);
    const result = await cli(await buildArgs(ws), { FAKE_AUDIO: '1' });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('silent placeholder audio');
    await expect(access(path.join(ws.outDir, 'manifest.json'))).resolves.toBeUndefined();
    expect(await ws.storedAudio()).toEqual([]);
    expect(await readdir(path.join(ws.outDir, 'audio'))).toHaveLength(2);
  });

  it('audio made by another provider does not satisfy the configured one', async () => {
    const ws = await createWorkspace(OK_LIST);
    await ws.build(); // the fake provider fills the store under its own file names
    const result = await cli(await buildArgs(ws));
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('audio file(s) are missing');
  });

  it('the audio command fails clearly without credentials, and refuses --fake-audio', async () => {
    const ws = await createWorkspace(OK_LIST);
    const base = ['audio', '--content', ws.contentDir, '--audio-store', ws.audioStoreDir];
    const noKey = await cli(base);
    expect(noKey.code).not.toBe(0);
    expect(noKey.stderr).toContain('AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must both be set');

    const fake = await cli([...base, '--fake-audio']);
    expect(fake.code).not.toBe(0);
    expect(fake.stderr).toContain('--fake-audio');
    expect(await ws.storedAudio()).toEqual([]);
  });

  it('the audio command validates the lists first and requests nothing when they are invalid', async () => {
    const ws = await createWorkspace({ 'chinese/x.yaml': listYaml('x', '\n  - target: A\n') });
    const result = await cli(['audio', '--content', ws.contentDir, '--audio-store', ws.audioStoreDir]);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('Content validation failed');
  });

  it('build --prune removes unreferenced audio from the audio store', async () => {
    const ws = await createWorkspace(OK_LIST);
    const stale = `${'a'.repeat(32)}.mp3`;
    await mkdir(ws.audioStoreDir, { recursive: true });
    await writeFile(path.join(ws.audioStoreDir, stale), 'x');
    const result = await cli(await buildArgs(ws, ['--fake-audio', '--prune']));
    expect(result.code).toBe(0);
    expect(await ws.storedAudio()).not.toContain(stale);
    expect(result.stdout).toContain('pruned 1');
  });
});
