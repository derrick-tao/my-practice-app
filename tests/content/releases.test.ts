import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAndValidate } from '../../content-build/build.ts';
import type { Release } from '../../src/content/types.ts';
import { buildError, createWorkspace } from './harness.ts';

const release = (overrides: Partial<Release> = {}): Release => ({
  id: 'draw-plays-itself',
  date: '2026-10-20',
  title: 'Draw plays by itself',
  bullets: ['Characters now draw on their own; Replay shows them again.'],
  ...overrides,
});

/** Build a workspace whose release log is `log` (any JSON value), expect failure, return the message. */
async function failureFor(log: unknown): Promise<string> {
  const ws = await createWorkspace({ 'releases.json': typeof log === 'string' ? log : JSON.stringify(log) });
  return buildError(ws);
}

describe('release log validation: a good log passes', () => {
  it('builds with a well-formed log, newest first, with several releases on one day', async () => {
    const ws = await createWorkspace({
      'releases.json': JSON.stringify([
        release({ id: 'c', date: '2026-10-21' }),
        release({ id: 'b', date: '2026-10-20' }),
        release({ id: 'a', date: '2026-10-20', bullets: ['One', 'Two', 'Three', 'Four'] }),
      ]),
    });
    await expect(ws.build()).resolves.toMatchObject({ warnings: [] });
  });

  it('builds with no release log at all', async () => {
    const ws = await createWorkspace();
    await expect(ws.build()).resolves.toMatchObject({ warnings: [] });
  });
});

describe('the release log is published next to the manifest', () => {
  it('writes releases.json beside manifest.json, as validated, newest first', async () => {
    const log = [release({ id: 'newer', date: '2026-10-21' }), release({ id: 'older', date: '2026-10-20' })];
    const ws = await createWorkspace({ 'releases.json': JSON.stringify(log) });
    await ws.build();
    expect(JSON.parse(await readFile(path.join(ws.outDir, 'releases.json'), 'utf8'))).toEqual(log);
    await expect(readFile(path.join(ws.outDir, 'manifest.json'), 'utf8')).resolves.toBeTruthy();
  });

  it('publishes an empty list when the repo has no release log, so the file is always there to cache', async () => {
    const ws = await createWorkspace();
    await ws.build();
    expect(JSON.parse(await readFile(path.join(ws.outDir, 'releases.json'), 'utf8'))).toEqual([]);
  });
});

describe('release log validation: every rule fails with file, release and rule', () => {
  it('rejects a log that is not a list of releases', async () => {
    const message = await failureFor({ releases: [] });
    expect(message).toContain('releases.json');
    expect(message).toContain('[release-log-shape]');
  });

  it('rejects a log that is not valid JSON', async () => {
    const message = await failureFor('[{"id": ');
    expect(message).toContain('releases.json');
    expect(message).toContain('[release-log-shape]');
  });

  it('rejects a missing date', async () => {
    const { date: _date, ...noDate } = release();
    const message = await failureFor([noDate]);
    expect(message).toContain('releases.json');
    expect(message).toContain('release item 1 (draw-plays-itself)');
    expect(message).toContain('[required-field]');
    expect(message).toContain('"date"');
  });

  it('rejects a date that is not a real day written YYYY-MM-DD', async () => {
    for (const date of ['Oct 20', '2026-10-2', '2026-02-30']) {
      const message = await failureFor([release({ date })]);
      expect(message).toContain('[date-format]');
    }
  });

  it('rejects an empty or blank title', async () => {
    for (const title of ['', '   ']) {
      const message = await failureFor([release({ title })]);
      expect(message).toContain('release item 1 (draw-plays-itself)');
      expect(message).toContain('[required-field]');
      expect(message).toContain('"title"');
    }
  });

  it('rejects a release with no bullets', async () => {
    const message = await failureFor([release({ bullets: [] })]);
    expect(message).toContain('release item 1 (draw-plays-itself)');
    expect(message).toContain('[bullet-count]');
  });

  it('rejects more than four bullets', async () => {
    const message = await failureFor([release({ bullets: ['1', '2', '3', '4', '5'] })]);
    expect(message).toContain('[bullet-count]');
    expect(message).toContain('5');
  });

  it('rejects an empty bullet', async () => {
    const message = await failureFor([release({ bullets: ['Fine', ' '] })]);
    expect(message).toContain('[required-field]');
    expect(message).toContain('bullet 2');
  });

  it('rejects dates that are not newest first', async () => {
    const message = await failureFor([release({ id: 'older', date: '2026-10-19' }), release({ id: 'newer', date: '2026-10-20' })]);
    expect(message).toContain('release item 2 (newer)');
    expect(message).toContain('[newest-first]');
  });

  it('rejects a duplicate id', async () => {
    const message = await failureFor([release(), release({ date: '2026-10-19' })]);
    expect(message).toContain('release item 2 (draw-plays-itself)');
    expect(message).toContain('[unique-id]');
  });

  it('rejects an unknown key', async () => {
    const message = await failureFor([{ ...release(), colour: 'red' }]);
    expect(message).toContain('[unknown-key]');
    expect(message).toContain('"colour"');
  });

  it('reports every problem together', async () => {
    const message = await failureFor([release({ title: '' }), release({ bullets: [] })]);
    expect(message).toContain('[required-field]');
    expect(message).toContain('[bullet-count]');
    expect(message).toContain('[unique-id]');
  });
});

// Guards the real content/releases.json: it is the log a grown-up reads, so it must validate, and it is written
// in plain grown-up voice.
describe('the real release log', () => {
  it('validates and holds the seeded releases, newest first', async () => {
    const { releases } = await loadAndValidate(path.resolve('content'));
    expect(releases.length).toBeGreaterThanOrEqual(6);
    const dates = releases.map((r) => r.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('keeps every title short enough to scan in the list', async () => {
    const { releases } = await loadAndValidate(path.resolve('content'));
    for (const { id, title } of releases) expect(title.length, `${id}: "${title}"`).toBeLessThanOrEqual(40);
  });

  it('keeps pull request titles, commit prefixes and code terms out of the wording', async () => {
    const text = await readFile(path.resolve('content/releases.json'), 'utf8');
    const words = JSON.parse(text).flatMap((r: Release) => [r.title, ...r.bullets]) as string[];
    for (const line of words) {
      expect(line).not.toMatch(/^(feat|fix|chore|docs|refactor|test)(\(.*\))?:/);
      expect(line).not.toMatch(/#\d+|\bPR\b|schema|service worker|\.tsx?\b/i);
    }
  });
});
