// Blocks learner data (e.g. the child's name) from reaching the public repo.
//
// Scans content against a local-only, git-ignored `.privacy-denylist` at the repository root: one term per
// line, matched case-insensitively as a substring. Blank lines and lines starting with `#` are ignored.
//
//   tsx scripts/privacy-check.ts          scan what is staged (what the pre-commit hook runs)
//   tsx scripts/privacy-check.ts --all    scan every tracked file, as committed to the index
//
// Exit 0 and silence when nothing matches or when there is no denylist (as in CI). Exit 1 on a match, naming
// each file and line. It never prints a denylisted term or the matching text, so a log cannot leak the very
// thing being protected. Binary files are skipped; file names are checked too.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const DENYLIST = '.privacy-denylist';

function git(args: string[], cwd: string): Buffer {
  return execFileSync('git', args, { cwd, maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

const normalize = (text: string): string => text.normalize('NFC').toLowerCase();

function readTerms(root: string): string[] {
  let text: string;
  try {
    text = readFileSync(path.join(root, DENYLIST), 'utf8');
  } catch {
    return [];
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map(normalize);
}

const isBinary = (content: Buffer): boolean => content.subarray(0, 8000).includes(0);

function main(): number {
  const all = process.argv.includes('--all');
  const root = git(['rev-parse', '--show-toplevel'], process.cwd()).toString('utf8').trim();
  const terms = readTerms(root);
  if (terms.length === 0) return 0;

  const listing = all
    ? git(['ls-files', '-z'], root)
    : git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], root);
  const files = listing.toString('utf8').split('\0').filter(Boolean);

  const hits: string[] = [];
  for (const file of files) {
    if (terms.some((term) => normalize(file).includes(term))) hits.push(`${file}: file name matches the denylist`);
    const content = git(['show', `:${file}`], root);
    if (isBinary(content)) continue;
    content
      .toString('utf8')
      .split(/\r?\n/)
      .forEach((line, index) => {
        const text = normalize(line);
        if (terms.some((term) => text.includes(term))) hits.push(`${file}:${index + 1}: matches the denylist`);
      });
  }

  if (hits.length === 0) return 0;
  console.error(`Privacy check failed (${DENYLIST}). Remove the learner data from:`);
  for (const hit of hits) console.error(`  ${hit}`);
  return 1;
}

process.exitCode = main();
