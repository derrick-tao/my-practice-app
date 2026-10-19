// Seam 1 helper: the parent publishes a new version of a lesson while the app is installed on the device.
//
// The fixture site serves fixed content, so a test stands in for "the parent published a change" by
// making the site answer later requests for the lesson (and the manifest's item count for it) with an
// edited copy. Everything goes through the public surface the app itself uses: HTTP. The next load of
// the app (a reload, or leaving and reopening) sees the edit; loads before the call are unaffected.
import type { Page } from '@playwright/test';
import type { ItemData, LessonData, Manifest } from '../../src/content/types.ts';

/** The lesson with a different dictation list. */
export const withDictation = (lesson: LessonData, items: ItemData[]): LessonData => ({
  ...lesson,
  lists: { ...lesson.lists, dictation: items },
});

/** From now on the site serves `edit(original)` for this lesson. Call again to replace the edit. */
export async function publishLessonEdit(page: Page, lessonId: string, edit: (lesson: LessonData) => LessonData): Promise<void> {
  await page.route(`**/content/lessons/${lessonId}.*.json`, async (route) => {
    const original = (await (await route.fetch()).json()) as LessonData;
    await route.fulfill({ json: edit(original) });
  });
  await page.route('**/content/manifest.json', async (route) => {
    const manifest = (await (await route.fetch()).json()) as Manifest;
    for (const subject of manifest.subjects) {
      for (const lesson of subject.lessons) {
        if (lesson.id !== lessonId) continue;
        const original = (await (await route.fetch({ url: new URL(lesson.file, route.request().url()).href })).json()) as LessonData;
        const edited = edit(original);
        for (const type of lesson.practiceTypes) type.itemCount = edited.lists[type.id]?.length ?? type.itemCount;
      }
    }
    await route.fulfill({ json: manifest });
  });
}
