import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { createWorkspace, listYaml } from './harness.ts';

const run = promisify(execFile);
const CLI = path.resolve('content-build/cli.ts');

async function cli(args: string[]) {
  try {
    const { stdout, stderr } = await run('npx', ['tsx', CLI, ...args], { encoding: 'utf8' });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const e = error as { code: number; stdout: string; stderr: string };
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}

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
    const ws = await createWorkspace({
      'chinese/ok.yaml': listYaml('ok', '\n  - target: 找\n    clue: 找东西\n'),
    });
    const result = await cli(['validate', '--content', ws.contentDir]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('1 list');
  });

  it('build writes the manifest and does not write output when invalid', async () => {
    const good = await createWorkspace({
      'chinese/ok.yaml': listYaml('ok', '\n  - target: 找\n    clue: 找东西\n'),
    });
    const ok = await cli(['build', '--content', good.contentDir, '--out', good.outDir, '--audio-store', good.audioStoreDir]);
    expect(ok.code).toBe(0);
    await expect(access(path.join(good.outDir, 'manifest.json'))).resolves.toBeUndefined();

    const bad = await createWorkspace({ 'chinese/x.yaml': listYaml('x', '\n  - target: A\n') });
    const failed = await cli(['build', '--content', bad.contentDir, '--out', bad.outDir, '--audio-store', bad.audioStoreDir]);
    expect(failed.code).not.toBe(0);
    await expect(access(path.join(bad.outDir, 'manifest.json'))).rejects.toThrow();
  });
});
