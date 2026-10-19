// Seam 1 harness shared by all e2e specs.
//
//  - The app under test is the real build served under /my-practice-app/ with fixture content
//    (tests/fixtures/content/e2e). See playwright.config.ts.
//  - Audio playback is stubbed: `HTMLMediaElement.play()` records the request instead of playing,
//    so tests can tell whether, when and at what rate (normal vs slow) audio was requested.
import { expect, test as base, type APIRequestContext, type Page } from '@playwright/test';
import type { LessonData, Manifest, Rendition } from '../../src/content/types.ts';

/** Where the served site keeps a lesson's data (its file name carries a content hash), read from the served manifest. */
export async function lessonPath(request: APIRequestContext, id: string): Promise<string> {
  const manifest = (await (await request.get('content/manifest.json')).json()) as Manifest;
  const summary = manifest.subjects.flatMap((s) => s.lessons).find((l) => l.id === id);
  if (!summary) throw new Error(`no published lesson "${id}"`);
  return `content/${summary.file}`;
}

export interface PlayedAudio {
  /** Path relative to the content root, e.g. `audio/<hash>.mp3`. */
  ref: string;
  /** Resolved against the lesson data: which item and rendition it is, when known. */
  target?: string;
  rendition?: Rendition;
}

export interface AudioProbe {
  /** Every character-audio play() request so far (not sound effects), oldest first, resolved against `lesson` when given. */
  played(lesson?: LessonData): Promise<PlayedAudio[]>;
  /** Sound effects requested so far, oldest first, by name: 'chime' (✅), 'gentle' (❌), 'fanfare' (completion). */
  effects(): Promise<string[]>;
  /** Forget both the character audio and the sound effects requested so far. */
  clear(): Promise<void>;
}

declare global {
  interface Window {
    __audioPlays: string[];
  }
}

function installAudioStub(): void {
  window.__audioPlays = [];
  HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement): Promise<void> {
    window.__audioPlays.push(this.currentSrc || this.src);
    return Promise.resolve();
  };
  HTMLMediaElement.prototype.pause = function pause(): void {};
}

function audioProbe(page: Page): AudioProbe {
  return {
    async played(lesson) {
      const urls = (await page.evaluate(() => window.__audioPlays)).filter((url) => url.includes('/content/'));
      return urls.map((url) => {
        const ref = url.slice(url.indexOf('/content/') + '/content/'.length);
        const hit = lesson?.lists.dictation
          ?.flatMap((item) => [
            { item, rendition: 'normal' as const, audioRef: item.audio.normal },
            { item, rendition: 'slow' as const, audioRef: item.audio.slow },
          ])
          .find((entry) => entry.audioRef === ref);
        return hit ? { ref, target: hit.item.target, rendition: hit.rendition } : { ref };
      });
    },
    async effects() {
      const urls = await page.evaluate(() => window.__audioPlays);
      return urls.flatMap((url) => /\/sounds\/([a-z-]+)\.wav$/.exec(url)?.[1] ?? []);
    },
    clear: () => page.evaluate(() => void (window.__audioPlays.length = 0)),
  };
}

export const test = base.extend<{ audio: AudioProbe; loadLesson: (id: string) => Promise<LessonData> }>({
  audio: async ({ page }, use) => {
    await page.addInitScript(installAudioStub);
    await use(audioProbe(page));
  },
  loadLesson: async ({ page }, use) => {
    await use(async (id) => {
      const response = await page.request.get(await lessonPath(page.request, id));
      expect(response.ok(), `lesson ${id} should be served`).toBe(true);
      return (await response.json()) as LessonData;
    });
  },
});

export { expect };
