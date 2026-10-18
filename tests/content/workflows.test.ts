import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// Guards the privacy rule "the Azure key is never given to pull-request builds" and the order of the
// main workflow (generate audio -> commit it -> build -> tests -> deploy). These are the only workflow
// facts we can check without a real run on GitHub.
interface Step {
  name?: string;
  run?: string;
  uses?: string;
  env?: Record<string, string>;
}
interface Workflow {
  on: Record<string, unknown>;
  permissions?: Record<string, string>;
  env?: Record<string, string>;
  concurrency?: { group: string; 'cancel-in-progress': boolean };
  jobs: Record<string, { permissions?: Record<string, string>; env?: Record<string, string>; needs?: string; steps: Step[] }>;
}

async function load(file: string): Promise<{ text: string; workflow: Workflow }> {
  const text = await readFile(`.github/workflows/${file}`, 'utf8');
  return { text, workflow: parse(text) as Workflow };
}

describe('pull-request workflow (ci.yml)', () => {
  it('references no secrets at all, and never runs on pull_request_target', async () => {
    const { text, workflow } = await load('ci.yml');
    expect(text).not.toMatch(/secrets\./);
    expect(text).not.toMatch(/\$\{\{\s*secrets/);
    expect(text).not.toContain('AZURE_SPEECH');
    expect(Object.keys(workflow.on)).toEqual(['pull_request']);
  });

  it('is read-only, and opts in to placeholder audio explicitly for the check step only', async () => {
    const { workflow } = await load('ci.yml');
    expect(workflow.permissions).toEqual({ contents: 'read' });
    const steps = workflow.jobs.check!.steps;
    const check = steps.find((s) => s.run === 'npm run check')!;
    expect(check.env).toEqual({ FAKE_AUDIO: '1' });
    expect(workflow.env).toBeUndefined();
    expect(workflow.jobs.check!.env).toBeUndefined();
  });
});

describe('main workflow (deploy.yml)', () => {
  it('uses the Azure secrets only in the audio generation step', async () => {
    const { text, workflow } = await load('deploy.yml');
    const usedIn = Object.values(workflow.jobs).flatMap((job) =>
      job.steps.filter((step) => JSON.stringify(step).includes('secrets.')).map((step) => step.name),
    );
    expect(usedIn).toEqual(['Generate audio for new or changed items']);
    expect(workflow.env).toBeUndefined();
    expect(workflow.jobs.build!.env).toBeUndefined();
    // Never on a command line, where `ps` could show it.
    expect(text).not.toMatch(/run:.*secrets\./);
    const generate = workflow.jobs.build!.steps.find((s) => s.name?.startsWith('Generate audio'))!;
    expect(Object.keys(generate.env!).sort()).toEqual(['AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION']);
    expect(generate.run).not.toContain('AZURE_SPEECH');
  });

  it('generates audio, commits it with [skip ci], then builds, tests and deploys in the same run', async () => {
    const { workflow } = await load('deploy.yml');
    const build = workflow.jobs.build!;
    const order = (needle: string) => build.steps.findIndex((s) => (s.run ?? s.uses ?? '').includes(needle));
    expect(order('npm run validate')).toBeLessThan(order('audio:generate'));
    expect(order('audio:generate')).toBeLessThan(order('git commit'));
    expect(order('git commit')).toBeLessThan(order('npm run test:content'));
    expect(order('git commit')).toBeLessThan(order('npm run build'));
    expect(order('npm run build')).toBeLessThan(order('npm run test:e2e'));
    expect(order('npm run test:e2e')).toBeLessThan(order('upload-pages-artifact'));

    const commit = build.steps[order('git commit')]!;
    expect(commit.run).toContain('[skip ci]');
    expect(build.permissions).toEqual({ contents: 'write' });
    expect(workflow.jobs.deploy!.needs).toBe('build');
    expect(workflow.jobs.deploy!.permissions).toEqual({ pages: 'write', 'id-token': 'write' });
  });

  it('generates with pruning, checks out the tip of main, and never overlaps another run', async () => {
    const { workflow } = await load('deploy.yml');
    const steps = workflow.jobs.build!.steps;
    expect(steps.find((s) => s.run?.includes('audio:generate'))!.run).toContain('--prune');
    const checkout = steps.find((s) => s.uses?.startsWith('actions/checkout'))! as Step & { with: { ref: string } };
    expect(checkout.with.ref).toBe('main');
    expect(workflow.concurrency).toEqual({ group: 'pages', 'cancel-in-progress': false });
  });
});
