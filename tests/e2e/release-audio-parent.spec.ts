// Seam 1: the parent area's audio is let go when the app is hidden or closed, like the practice screens'
// (release-audio.spec.ts). Lesson preview and both progress pages (a lesson's, and one attempt's) play
// audio from a tap only; after a hide or close, the next tap plays again.
import type { Page } from '@playwright/test';
import type { LessonData } from '../../src/content/types.ts';
import { restoreSessions, type SessionJson } from './backup-driver.ts';
import { expect, test, type AudioProbe } from './harness.ts';
import { openParentArea, openParentSection, setUpLearner } from './parent-driver.ts';

// One completed attempt on fixture-three: 点 missed in round 1, so it is both "trickiest" and a missed character.
const WHEN = '2026-10-01T12:00:00.000Z';
const ATTEMPT: SessionJson = {
  id: 'release-1',
  profileId: 'replaced-on-restore',
  subject: 'chinese',
  practiceType: 'dictation',
  lessonId: 'fixture-three',
  contentVersion: 'saved-before',
  status: 'completed',
  startedAt: WHEN,
  completedAt: WHEN,
  updatedAt: WHEN,
  rounds: [
    {
      index: 1,
      itemIds: ['找', '点', '分'],
      position: 3,
      phase: 'prompt',
      heardCurrent: false,
      marks: { 找: 'correct', 点: 'wrong', 分: 'correct' },
      startedAt: WHEN,
      completedAt: WHEN,
    },
    {
      index: 2,
      itemIds: ['点'],
      position: 1,
      phase: 'prompt',
      heardCurrent: false,
      marks: { 点: 'correct' },
      startedAt: WHEN,
      completedAt: WHEN,
    },
  ],
  undo: null,
  marksSinceBreak: 0,
};

/** Audio is requested straight from a tap; a negative check gives a late request time to show up. */
const settle = (page: Page): Promise<void> => page.waitForTimeout(1000);

interface Screen {
  name: string;
  open(page: Page): Promise<void>;
  /** Tap something on the screen that plays audio. */
  tap(page: Page): Promise<void>;
}

async function openLessonProgress(page: Page): Promise<void> {
  await openParentArea(page);
  await openParentSection(page, 'Progress');
  await page.getByRole('link', { name: /Fixture Three/ }).click();
}

const screens: Screen[] = [
  {
    name: 'lesson preview',
    open: async (page) => {
      await openParentArea(page);
      await openParentSection(page, 'Lesson preview');
      await page.getByRole('link', { name: /Fixture Three/ }).click();
      await expect(page.getByTestId('preview-item')).toHaveCount(3);
    },
    tap: (page) => page.getByTestId('preview-item').nth(1).getByRole('button', { name: /^Normal/ }).click(),
  },
  {
    name: "a lesson's progress page",
    open: async (page) => {
      await openLessonProgress(page);
      await expect(page.getByTestId('tricky')).toHaveCount(1);
    },
    tap: (page) => page.getByTestId('tricky').getByRole('button', { name: 'Hear 点' }).click(),
  },
  {
    name: "an attempt's progress page",
    open: async (page) => {
      await openLessonProgress(page);
      await page.getByTestId('progress-part-dictation').getByTestId('attempt').first().click();
      await expect(page.getByTestId('round')).toHaveCount(2);
    },
    tap: (page) => page.getByTestId('round').nth(0).getByRole('button', { name: 'Hear 点' }).click(),
  },
];

interface Fixtures {
  page: Page;
  audio: AudioProbe;
  loadLesson: (id: string) => Promise<LessonData>;
}

/** Open the screen and play once; returns the audio file that was requested. */
async function start({ page, audio, loadLesson }: Fixtures, screen: Screen): Promise<{ lesson: LessonData; heard: string }> {
  await setUpLearner(page);
  await restoreSessions(page, [ATTEMPT]);
  await screen.open(page);
  const lesson = await loadLesson('fixture-three');
  await screen.tap(page);
  await expect.poll(async () => (await audio.played(lesson)).length).toBe(1);
  return { lesson, heard: (await audio.played(lesson))[0]!.ref };
}

for (const screen of screens) {
  test.describe(`audio is let go when the app is hidden or closed: ${screen.name}`, () => {
    test('hiding the page stops and lets go of the audio, and the next tap plays again', async ({ page, audio, loadLesson }) => {
      const { lesson, heard } = await start({ page, audio, loadLesson }, screen);

      await audio.hide();

      expect(await audio.paused()).toContainEqual(expect.stringContaining(heard));
      expect(await audio.released()).toContainEqual(expect.stringContaining(heard));
      expect(await audio.reloads()).toBeGreaterThan(0);

      await audio.show();
      await settle(page);
      expect(await audio.played(lesson)).toHaveLength(1);

      await screen.tap(page);
      await expect.poll(async () => (await audio.played(lesson)).length).toBe(2);
      expect((await audio.played(lesson)).at(-1)!.ref).toBe(heard);
    });

    test('closing the page does the same', async ({ page, audio, loadLesson }) => {
      const { lesson, heard } = await start({ page, audio, loadLesson }, screen);

      await audio.close();

      expect(await audio.paused()).toContainEqual(expect.stringContaining(heard));
      expect(await audio.released()).toContainEqual(expect.stringContaining(heard));
      expect(await audio.reloads()).toBeGreaterThan(0);

      await audio.show();
      await settle(page);
      expect(await audio.played(lesson)).toHaveLength(1);

      await screen.tap(page);
      await expect.poll(async () => (await audio.played(lesson)).length).toBe(2);
    });
  });
}
