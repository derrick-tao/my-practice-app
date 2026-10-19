// Opt-in: installs a git pre-commit hook that runs the privacy check on staged content (`npm run
// privacy:install-hook`). Nothing installs it automatically. It never overwrites a pre-commit hook it did not
// write, and running it again just refreshes its own hook.
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const MARKER = '# my-practice-app privacy check (installed by `npm run privacy:install-hook`)';
const HOOK = `#!/bin/sh
${MARKER}
# Blocks the commit when staged content matches the local, git-ignored .privacy-denylist.
# Passes silently when there is no denylist. Remove this file to uninstall.
exec npx --no-install tsx scripts/privacy-check.ts --staged
`;

function main(): number {
  // The hooks directory is shared by all worktrees of a clone (and honors core.hooksPath).
  const hookPath = path.resolve(
    execFileSync('git', ['rev-parse', '--git-path', 'hooks/pre-commit'], { encoding: 'utf8' }).trim(),
  );
  if (existsSync(hookPath) && !readFileSync(hookPath, 'utf8').includes(MARKER)) {
    console.error(`A different pre-commit hook already exists at ${hookPath}; not overwriting it.`);
    console.error('Add `npx --no-install tsx scripts/privacy-check.ts --staged` to it yourself.');
    return 1;
  }
  mkdirSync(path.dirname(hookPath), { recursive: true });
  writeFileSync(hookPath, HOOK);
  chmodSync(hookPath, 0o755);
  console.log(`Installed the privacy pre-commit hook at ${hookPath}`);
  return 0;
}

process.exitCode = main();
