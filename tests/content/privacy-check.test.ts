import { execFile } from 'node:child_process';
import { chmod, cp, mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

// Documented exception to "Seam 2 is the content build": the privacy check is a build-time tool script, so its
// CLI tests share Seam 2's runner (like workflows.test.ts). They drive it only through its command line, inside
// a throwaway git repository, and never touch a real denylist.
const run = promisify(execFile);
// The repo's own tsx binary, called directly: much faster than `npx` when many throwaway repos are checked.
const TSX = path.resolve('node_modules/.bin/tsx');
const SCRIPTS = path.resolve('scripts');
const CHECK = path.join(SCRIPTS, 'privacy-check.ts');
const INSTALL = path.join(SCRIPTS, 'install-privacy-hook.ts');

interface Result {
  code: number;
  stdout: string;
  stderr: string;
}

async function exec(file: string, args: string[], cwd: string): Promise<Result> {
  try {
    const { stdout, stderr } = await run(file, args, { cwd, encoding: 'utf8' });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const e = error as { code: number; stdout: string; stderr: string };
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}

const git = (cwd: string, ...args: string[]) => exec('git', args, cwd);
const check = (cwd: string, ...args: string[]) => exec(TSX, [CHECK, ...args], cwd);

async function createRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'privacy-'));
  await git(dir, 'init', '-q');
  await git(dir, 'config', 'user.email', 'test@example.com');
  await git(dir, 'config', 'user.name', 'Test');
  await git(dir, 'config', 'commit.gpgsign', 'false');
  return dir;
}

async function write(dir: string, file: string, content: string | Buffer): Promise<void> {
  await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
  await writeFile(path.join(dir, file), content);
}

async function stage(dir: string, file: string, content: string | Buffer): Promise<void> {
  await write(dir, file, content);
  await git(dir, 'add', file);
}

describe('privacy check: staged content against a local denylist', () => {
  it('blocks a staged file containing a denylisted term, naming the file and line but never echoing the term', async () => {
    const dir = await createRepo();
    await write(dir, '.privacy-denylist', 'Zhangweiwei\n');
    await stage(dir, 'notes/todo.md', 'line one\nsay hi to ZHANGWEIWEI today\nline three\n');

    const result = await check(dir);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('notes/todo.md:2');
    expect(result.stderr.toLowerCase()).not.toContain('zhangweiwei');
    expect(result.stdout.toLowerCase()).not.toContain('zhangweiwei');
  });

  it('reports every matching file and line', async () => {
    const dir = await createRepo();
    await write(dir, '.privacy-denylist', 'secretname\nanother one\n');
    await stage(dir, 'a.txt', 'secretname\nfine\nAnother One here\n');
    await stage(dir, 'b/c.txt', 'x secretname y');

    const result = await check(dir);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('a.txt:1');
    expect(result.stderr).toContain('a.txt:3');
    expect(result.stderr).toContain('b/c.txt:1');
  });

  it('passes silently when there is no denylist (as in CI)', async () => {
    const dir = await createRepo();
    await stage(dir, 'notes.md', 'Zhangweiwei appears here\n');

    const result = await check(dir);

    expect(result).toEqual({ code: 0, stdout: '', stderr: '' });
  });

  it('passes silently when staged content is clean', async () => {
    const dir = await createRepo();
    await write(dir, '.privacy-denylist', 'Zhangweiwei\n');
    await stage(dir, 'notes.md', 'nothing private\n');

    expect(await check(dir)).toEqual({ code: 0, stdout: '', stderr: '' });
  });

  it('ignores blank lines, comments and surrounding whitespace in the denylist', async () => {
    const dir = await createRepo();
    await write(dir, '.privacy-denylist', '# the child\n\n   \n  Mei Mei  \n');
    await stage(dir, 'ok.txt', 'a line with spaces and no match\n');
    expect((await check(dir)).code).toBe(0);

    await stage(dir, 'bad.txt', 'hello mei mei\n');
    const result = await check(dir);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('bad.txt:1');
    expect(result.stderr).not.toContain('ok.txt');
  });

  it('scans what is staged, not the working tree', async () => {
    const dir = await createRepo();
    await write(dir, '.privacy-denylist', 'Zhangweiwei\n');
    await stage(dir, 'notes.md', 'clean\n');
    await write(dir, 'notes.md', 'clean\nZhangweiwei added after staging\n');
    expect((await check(dir)).code).toBe(0);

    await git(dir, 'add', 'notes.md');
    expect((await check(dir)).code).toBe(1);
  });

  it('blocks a file whose name contains a denylisted term', async () => {
    const dir = await createRepo();
    await write(dir, '.privacy-denylist', 'Zhangweiwei\n');
    await stage(dir, 'zhangweiwei-progress.txt', 'nothing inside\n');

    const result = await check(dir);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('zhangweiwei-progress.txt');
    expect(result.stderr).toContain('file name');
  });

  it('skips binary files', async () => {
    const dir = await createRepo();
    await write(dir, '.privacy-denylist', 'zhang\n');
    await stage(dir, 'audio.mp3', Buffer.from([0x49, 0x44, 0x33, 0x00, 0x7a, 0x68, 0x61, 0x6e, 0x67, 0x00]));

    expect((await check(dir)).code).toBe(0);
  });

  it('passes when nothing is staged', async () => {
    const dir = await createRepo();
    await write(dir, '.privacy-denylist', 'Zhangweiwei\n');
    expect((await check(dir)).code).toBe(0);
  });

  it('--all scans every tracked file, including already-committed ones', async () => {
    const dir = await createRepo();
    await stage(dir, 'old.md', 'Zhangweiwei was committed before the denylist existed\n');
    await git(dir, 'commit', '-q', '-m', 'old');
    await write(dir, '.privacy-denylist', 'Zhangweiwei\n');

    expect((await check(dir)).code).toBe(0); // nothing staged
    const result = await check(dir, '--all');
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('old.md:1');
  });

  it('works from a subdirectory of the repository', async () => {
    const dir = await createRepo();
    await write(dir, '.privacy-denylist', 'Zhangweiwei\n');
    await stage(dir, 'deep/notes.md', 'Zhangweiwei\n');

    const result = await check(path.join(dir, 'deep'));

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('deep/notes.md:1');
  });
});

describe('privacy hook installer (opt-in)', () => {
  async function createRepoWithTooling(): Promise<string> {
    const dir = await createRepo();
    await mkdir(path.join(dir, 'scripts'));
    await cp(CHECK, path.join(dir, 'scripts/privacy-check.ts'));
    await symlink(path.resolve('node_modules'), path.join(dir, 'node_modules'));
    await write(dir, '.gitignore', 'node_modules\n.privacy-denylist\n');
    return dir;
  }
  const install = (cwd: string) => exec(TSX, [INSTALL], cwd);

  it('installs a pre-commit hook that blocks a commit with a match and lets clean commits through', async () => {
    const dir = await createRepoWithTooling();
    expect((await install(dir)).code).toBe(0);
    await write(dir, '.privacy-denylist', 'Zhangweiwei\n');

    await stage(dir, 'bad.md', 'about Zhangweiwei\n');
    const blocked = await git(dir, 'commit', '-q', '-m', 'bad');
    expect(blocked.code).not.toBe(0);
    expect(blocked.stderr).toContain('bad.md:1');

    await git(dir, 'rm', '-q', '--cached', 'bad.md');
    await stage(dir, 'good.md', 'all fine\n');
    expect((await git(dir, 'commit', '-q', '-m', 'good')).code).toBe(0);
  });

  it('lets commits proceed when there is no denylist', async () => {
    const dir = await createRepoWithTooling();
    await install(dir);
    await stage(dir, 'bad.md', 'about Zhangweiwei\n');

    expect((await git(dir, 'commit', '-q', '-m', 'ok')).code).toBe(0);
  });

  it('is safe to run twice and never overwrites a hook it did not write', async () => {
    const dir = await createRepoWithTooling();
    expect((await install(dir)).code).toBe(0);
    expect((await install(dir)).code).toBe(0);

    const other = await createRepoWithTooling();
    const hook = path.join(other, '.git/hooks/pre-commit');
    await writeFile(hook, '#!/bin/sh\necho my own hook\n');
    await chmod(hook, 0o755);
    const result = await install(other);

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('pre-commit');
    expect(await readFile(hook, 'utf8')).toBe('#!/bin/sh\necho my own hook\n');
  });
});
