import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';
import type { Release } from '../../src/content/types.ts';
import { createWorkspace, lessonYaml } from './harness.ts';

const release = (id: string, date: string): Release => ({ id, date, title: `Title of ${id}`, bullets: ['Something got better.'] });

/** Run the production app build (the real vite.config.ts) over the content in `contentOut`; return the app's script text. */
async function appScript(contentOut: string): Promise<string> {
  process.env.CONTENT_OUT = contentOut;
  const outDir = await mkdtemp(path.join(tmpdir(), 'release-id-site-'));
  await build({ configFile: path.resolve('vite.config.ts'), logLevel: 'silent', build: { outDir, emptyOutDir: true } });
  const assets = (await readdir(path.join(outDir, 'assets'))).filter((file) => file.endsWith('.js'));
  const scripts = await Promise.all(assets.map((file) => readFile(path.join(outDir, 'assets', file), 'utf8')));
  return scripts.join('\n');
}

describe('the built app knows which release it is', () => {
  const saved = process.env.CONTENT_OUT;
  afterEach(() => {
    if (saved === undefined) delete process.env.CONTENT_OUT;
    else process.env.CONTENT_OUT = saved;
  });

  it('embeds the id of the newest release in the log, and no other', async () => {
    const ws = await createWorkspace({
      'chinese/x.yaml': lessonYaml('x', '\n  - target: 大\n'),
      'releases.json': JSON.stringify([release('newest-xyzzy', '2026-10-21'), release('older-plugh', '2026-10-20')]),
    });
    await ws.build();
    const script = await appScript(ws.outDir);
    expect(script.includes('newest-xyzzy'), 'newest id is in the app').toBe(true);
    expect(script.includes('older-plugh'), 'an older id is not').toBe(false);
  });

  it('embeds what the newest release says too, so the app can show its own release without the log', async () => {
    const ws = await createWorkspace({
      'chinese/x.yaml': lessonYaml('x', '\n  - target: 大\n'),
      'releases.json': JSON.stringify([release('newest-xyzzy', '2026-10-21'), release('older-plugh', '2026-10-20')]),
    });
    await ws.build();
    const script = await appScript(ws.outDir);
    expect(script.includes('Title of newest-xyzzy'), 'newest title is in the app').toBe(true);
    expect(script.includes('Title of older-plugh'), 'an older title is not').toBe(false);
  });

  it('still builds when there is no release log', async () => {
    const ws = await createWorkspace({ 'chinese/x.yaml': lessonYaml('x', '\n  - target: 大\n') });
    await ws.build();
    expect((await appScript(ws.outDir)).length).toBeGreaterThan(0);
  });
});
