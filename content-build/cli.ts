// CLI used by npm scripts and CI.
//   tsx content-build/cli.ts validate [--content dir]
//   tsx content-build/cli.ts build [--content dir] [--out dir] [--audio-store dir] [--fake-audio] [--prune]
//   tsx content-build/cli.ts audio [--content dir] [--audio-store dir] [--prune]
//
// `audio` generates any missing real audio into the committed audio/ folder (the main deploy workflow runs
// it with the Azure secrets). `build` never needs credentials when audio/ is complete; if audio is missing
// it fails, unless --fake-audio (or FAKE_AUDIO=1) explicitly asks for silent placeholder audio, which is
// only for tests and pull-request CI and is never written to audio/.
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ttsConfig } from '../tts.config.ts';
import { MissingAudioError } from './audio.ts';
import { ContentBuildError, buildContent, generateAudio, loadAndValidate } from './build.ts';
import { createFakeProvider } from './tts/fake-provider.ts';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    content: { type: 'string', default: 'content' },
    out: { type: 'string', default: '.generated/content' },
    'audio-store': { type: 'string', default: 'audio' },
    'fake-audio-store': { type: 'string', default: '.generated/fake-audio' },
    'fake-audio': { type: 'boolean', default: false },
    prune: { type: 'boolean', default: false },
  },
});

function report(warnings: string[]): void {
  for (const warning of warnings) console.warn(`warning: ${warning}`);
}

function fakeAudioRequested(): boolean {
  return values['fake-audio'] || ['1', 'true'].includes(process.env.FAKE_AUDIO ?? '');
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

  const log = (line: string): void => console.log(line);
  const common = {
    contentDir,
    audioStoreDir: path.resolve(values['audio-store']),
    tts: ttsConfig,
    prune: values.prune,
    log,
  };

  if (command === 'audio') {
    if (fakeAudioRequested()) {
      throw new Error('The audio command generates real audio and is never combined with --fake-audio / FAKE_AUDIO.');
    }
    const stats = await generateAudio(common);
    console.log(
      `Audio: ${stats.needed} file(s) needed, ${stats.requested} generated, ${stats.pruned.length} pruned.`,
    );
    return;
  }

  if (command === 'build') {
    const result = await buildContent({
      ...common,
      outDir: path.resolve(values.out),
      ...(fakeAudioRequested() && {
        placeholder: { provider: createFakeProvider(), storeDir: path.resolve(values['fake-audio-store']) },
      }),
    });
    report(result.warnings);
    console.log(`Built content ${result.contentVersion} into ${values.out}.`);
    return;
  }

  throw new Error('usage: cli.ts <validate|build|audio> [--content dir] [--out dir] [--audio-store dir] [--fake-audio] [--prune]');
}

main().catch((error: unknown) => {
  const clear = error instanceof ContentBuildError || error instanceof MissingAudioError;
  console.error(clear ? (error as Error).message : error);
  process.exit(1);
});
