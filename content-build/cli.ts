// CLI used by npm scripts and CI.
//   tsx content-build/cli.ts validate [--content dir]
//   tsx content-build/cli.ts build [--content dir] [--out dir] [--audio-store dir]
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ttsConfig } from '../tts.config.ts';
import { ContentBuildError, buildContent, loadAndValidate } from './build.ts';
import { createProvider } from './tts/provider-factory.ts';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    content: { type: 'string', default: 'content' },
    out: { type: 'string', default: '.generated/content' },
    'audio-store': { type: 'string' },
  },
});

function report(warnings: string[]): void {
  for (const warning of warnings) console.warn(`warning: ${warning}`);
}

async function main(): Promise<void> {
  const command = positionals[0];
  const contentDir = path.resolve(values.content);

  if (command === 'validate') {
    const { sources, warnings } = await loadAndValidate(contentDir);
    report(warnings);
    console.log(`Validated ${sources.length} list(s).`);
    return;
  }

  if (command === 'build') {
    const provider = createProvider(ttsConfig);
    // Real audio lives in the committed `audio/` folder (ticket 02). Fake placeholder audio never does.
    const audioStoreDir = path.resolve(
      values['audio-store'] ?? (provider.id === 'fake' ? '.generated/fake-audio' : 'audio'),
    );
    const result = await buildContent({
      contentDir,
      outDir: path.resolve(values.out),
      audioStoreDir,
      provider,
    });
    report(result.warnings);
    console.log(`Built content ${result.contentVersion} into ${values.out}.`);
    return;
  }

  throw new Error('usage: cli.ts <validate|build> [--content dir] [--out dir] [--audio-store dir]');
}

main().catch((error: unknown) => {
  console.error(error instanceof ContentBuildError ? error.message : error);
  process.exit(1);
});
