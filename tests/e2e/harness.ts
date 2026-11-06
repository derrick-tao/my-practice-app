// Seam 1 harness shared by all e2e specs.
//
//  - The app under test is the real build served under /my-practice-app/ with fixture content
//    (tests/fixtures/content/e2e). See playwright.config.ts.
//  - Audio playback is stubbed: `HTMLMediaElement.play()` records the request instead of playing,
//    so tests can tell whether, when and at what rate (normal vs slow) audio was requested. It also records
//    pause(), removing an element's source and load(), and a spec can hide/show the page and fire the
//    closing event, to see that every element was stopped and let go.
import { expect, test as base, type APIRequestContext, type Page } from '@playwright/test';
import type { ItemData, LessonData, Manifest, PracticeTypeId, Rendition } from '../../src/content/types.ts';

/** A lesson's lists as [practice type, items] pairs (the lesson data's own format: one key per list it offers). */
const listsOf = (lesson: LessonData | undefined): Array<[PracticeTypeId, ItemData[]]> =>
  Object.entries(lesson?.lists ?? {}) as Array<[PracticeTypeId, ItemData[]]>;

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
  /** The list the item belongs to (the same target can be in two lists). */
  practiceType?: PracticeTypeId;
  rendition?: Rendition;
}

export interface AudioProbe {
  /** Every character-audio play() request so far (not sound effects), oldest first, resolved against `lesson` when given. */
  played(lesson?: LessonData): Promise<PlayedAudio[]>;
  /** Sound effects requested so far, oldest first, by name: 'chime' (✅), 'gentle' (❌), 'fanfare' (completion). */
  effects(): Promise<string[]>;
  /** Forget the audio, effects and stop/release records so far. */
  clear(): Promise<void>;
  /** Sources of media elements that were paused, oldest first. */
  paused(): Promise<string[]>;
  /** Sources of media elements whose source was removed (let go), oldest first. */
  released(): Promise<string[]>;
  /** How many times load() was called on an element that no longer had a source (the rest of letting go). */
  reloads(): Promise<number>;
  /** The most recently played element whose source contains `source` (e.g. 'chime.wav', '/content/') plays to its end: `ended` fires on it. */
  finish(source: string): Promise<void>;
  /** The page goes to the background (a switch to another app, a locked phone): visibilitychange to hidden. */
  hide(): Promise<void>;
  /** The page comes back to the foreground: visibilitychange to visible. */
  show(): Promise<void>;
  /** The page is closed or put away: pagehide. */
  close(): Promise<void>;
}

declare global {
  interface Window {
    __audioPlays: string[];
    __audioPlayed: HTMLMediaElement[];
    __audioPauses: string[];
    __audioReleases: string[];
    __audioReloads: number;
  }
}

function installAudioStub(): void {
  window.__audioPlays = [];
  window.__audioPlayed = [];
  HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement): Promise<void> {
    window.__audioPlayed.push(this);
    window.__audioPlays.push(this.currentSrc || this.src);
    return Promise.resolve();
  };
  window.__audioPauses = [];
  window.__audioReleases = [];
  window.__audioReloads = 0;
  HTMLMediaElement.prototype.pause = function pause(this: HTMLMediaElement): void {
    window.__audioPauses.push(this.currentSrc || this.src);
  };
  const removeAttribute = Element.prototype.removeAttribute;
  Element.prototype.removeAttribute = function (this: Element, name: string): void {
    if (this instanceof HTMLMediaElement && name === 'src') window.__audioReleases.push(this.currentSrc || this.src);
    removeAttribute.call(this, name);
  };
  const load = HTMLMediaElement.prototype.load;
  HTMLMediaElement.prototype.load = function (this: HTMLMediaElement): void {
    if (!this.hasAttribute('src')) window.__audioReloads++;
    load.call(this);
  };
}

/** Make the page look hidden or visible to the app, as the browser does, and tell it. */
function setVisibility(state: 'hidden' | 'visible'): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  Object.defineProperty(document, 'hidden', { value: state === 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

function audioProbe(page: Page): AudioProbe {
  return {
    async played(lesson) {
      const urls = (await page.evaluate(() => window.__audioPlays)).filter((url) => url.includes('/content/'));
      return urls.map((url) => {
        const ref = url.slice(url.indexOf('/content/') + '/content/'.length);
        const hit = listsOf(lesson)
          .flatMap(([practiceType, items]) =>
            items.flatMap((item) => [
              { item, practiceType, rendition: 'normal' as const, audioRef: item.audio.normal },
              { item, practiceType, rendition: 'slow' as const, audioRef: item.audio.slow },
            ]),
          )
          .find((entry) => entry.audioRef === ref);
        return hit ? { ref, target: hit.item.target, practiceType: hit.practiceType, rendition: hit.rendition } : { ref };
      });
    },
    async effects() {
      const urls = await page.evaluate(() => window.__audioPlays);
      return urls.flatMap((url) => /\/sounds\/([a-z-]+)\.wav$/.exec(url)?.[1] ?? []);
    },
    clear: () =>
      page.evaluate(() => {
        window.__audioPlays.length = 0;
        window.__audioPlayed.length = 0;
        window.__audioPauses.length = 0;
        window.__audioReleases.length = 0;
        window.__audioReloads = 0;
      }),
    paused: () => page.evaluate(() => window.__audioPauses),
    released: () => page.evaluate(() => window.__audioReleases),
    reloads: () => page.evaluate(() => window.__audioReloads),
    finish: (source) =>
      page.evaluate((part) => {
        const element = window.__audioPlayed.findLast((el) => (el.currentSrc || el.src).includes(part));
        if (!element) throw new Error(`nothing with "${part}" has played`);
        element.dispatchEvent(new Event('ended'));
      }, source),
    hide: () => page.evaluate(setVisibility, 'hidden' as const),
    show: () => page.evaluate(setVisibility, 'visible' as const),
    close: () => page.evaluate(() => void window.dispatchEvent(new Event('pagehide'))),
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
