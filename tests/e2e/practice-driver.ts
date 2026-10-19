// Seam 1 helpers for driving the practice screens the way a child does (taps and visible text only).
// Later tickets (04 retries, 05 resume, 06 undo/breaks) reuse these.
import type { Locator, Page } from '@playwright/test';
import type { LessonData } from '../../src/content/types.ts';
import { expect, type AudioProbe } from './harness.ts';

declare global {
  interface Window {
    /** Set by `rejectAudioPlayback`: while true, play() rejects like iOS blocking auto-play. */
    __rejectAudio?: boolean;
  }
}

/** Seed the practice random source before the app loads (honored by test builds only). */
export async function seedRandom(page: Page, seed: number): Promise<void> {
  await page.addInitScript((value) => void (window.__practiceSeed = value), seed);
}

/**
 * Make audio play() reject (as iOS does outside a user gesture) until `allowAudioPlayback` is called.
 * Call after the `audio` fixture is active so this wraps the recording stub.
 */
export async function rejectAudioPlayback(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__rejectAudio = true;
    const recorded = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement): Promise<void> {
      if (window.__rejectAudio) return Promise.reject(new DOMException('Not allowed', 'NotAllowedError'));
      return recorded.call(this);
    };
  });
}

export const allowAudioPlayback = (page: Page): Promise<void> =>
  page.evaluate(() => void (window.__rejectAudio = false));

export class PracticeScreen {
  readonly listen: Locator;
  readonly slow: Locator;
  readonly check: Locator;
  readonly gotIt: Locator;
  readonly notYet: Locator;
  readonly home: Locator;
  readonly target: Locator;
  readonly progress: Locator;
  readonly summary: Locator;
  readonly retry: Locator;
  readonly roundBadge: Locator;
  readonly completion: Locator;
  /** The "↩️ Undo" chip shown after a mark. */
  readonly undo: Locator;
  /** The "Great job! Take a break?" prompt and its two choices. */
  readonly breakPrompt: Locator;
  readonly keepOn: Locator;
  readonly takeBreak: Locator;
  /** The home screen's resume card. */
  readonly keepGoing: Locator;

  constructor(
    readonly page: Page,
    readonly audio: AudioProbe,
    readonly lesson: LessonData,
  ) {
    this.listen = page.getByRole('button', { name: 'Listen' });
    this.slow = page.getByRole('button', { name: 'Slow' });
    this.check = page.getByRole('button', { name: 'Check' });
    this.gotIt = page.getByRole('button', { name: 'I got it' });
    this.notYet = page.getByRole('button', { name: 'Not yet' });
    this.home = page.getByRole('link', { name: 'Home' });
    this.target = page.getByTestId('target');
    this.progress = page.getByRole('progressbar');
    this.summary = page.getByTestId('round-summary');
    this.retry = page.getByRole('button', { name: /Practice the .* words/ });
    this.roundBadge = page.getByTestId('round-badge');
    this.completion = page.getByTestId('completion');
    this.undo = page.getByRole('button', { name: 'Undo' });
    this.breakPrompt = page.getByTestId('break-prompt');
    this.keepOn = page.getByRole('button', { name: 'Keep going' });
    this.takeBreak = page.getByRole('button', { name: 'Break' });
    this.keepGoing = page.getByRole('link', { name: /Keep going/ });
  }

  /** The lesson's card on the home screen (not the Keep going card, which also names the lesson). */
  lessonCard(): Locator {
    return this.page.getByRole('link', { name: new RegExp(this.lesson.title) }).filter({ hasNotText: 'Keep going' });
  }

  /** Home screen -> tap the lesson's card. */
  async open(): Promise<void> {
    await this.page.goto('./');
    await this.lessonCard().click();
  }

  /** Close and reopen the app (a fresh load of the home screen), then tap Keep going. */
  async reopenViaKeepGoing(): Promise<void> {
    await this.page.goto('./');
    await this.page.reload();
    await this.keepGoing.click();
  }

  /** The "n / total" text next to the star bar. */
  progressText(): Locator {
    return this.page.getByTestId('progress-text');
  }

  /** Item whose normal audio was most recently requested (what the child just heard). */
  async lastHeardTarget(): Promise<string | undefined> {
    const played = await this.audio.played(this.lesson);
    return played.at(-1)?.target;
  }

  /** How many times item audio has been requested so far. */
  async itemAudioCount(): Promise<number> {
    return (await this.audio.played(this.lesson)).length;
  }

  /**
   * Wait until item audio has been requested `count` times in all. After a mark, the next item's audio waits
   * for the ✅/❌ sound to finish, and leaving the screen before then drops it.
   */
  async waitForItemAudio(count: number): Promise<void> {
    await expect.poll(() => this.itemAudioCount()).toBe(count);
  }

  /** On the listening screen: tap Check and return the revealed target. */
  async reveal(): Promise<string> {
    await this.check.click();
    await expect(this.target).toBeVisible();
    return (await this.target.textContent())!;
  }

  /** On the listening screen: Check, then mark. Returns the revealed target. */
  async markNext(correct: boolean): Promise<string> {
    const target = await this.reveal();
    await (correct ? this.gotIt : this.notYet).click();
    return target;
  }

  /** Mark `count` items in a row (stops being meaningful at a round end or break prompt). */
  async markMany(count: number, isCorrect: (index: number) => boolean = () => true): Promise<string[]> {
    const order: string[] = [];
    for (let i = 0; i < count; i++) order.push(await this.markNext(isCorrect(i)));
    return order;
  }

  /**
   * Play the current round to its end. `isCorrect(target, indexInRound)` decides each mark.
   * Returns the targets in the order the round presented them. Stops at the round summary, or at
   * the completion screen when the round had no misses.
   */
  async playRound(isCorrect: (target: string, index: number) => boolean): Promise<string[]> {
    const order: string[] = [];
    for (;;) {
      await expect(this.check.or(this.summary).or(this.completion).or(this.breakPrompt)).toBeVisible();
      if (await this.breakPrompt.isVisible()) {
        await this.keepOn.click(); // a break prompt is not part of the round: carry on
        continue;
      }
      if (!(await this.check.isVisible())) return order;
      const target = await this.reveal();
      order.push(target);
      await (isCorrect(target, order.length - 1) ? this.gotIt : this.notYet).click();
    }
  }

  /** On the round summary: tap "Practice the ❌ words" and play that round. */
  async playRetryRound(isCorrect: (target: string, index: number) => boolean): Promise<string[]> {
    await this.retry.click();
    return this.playRound(isCorrect);
  }
}
