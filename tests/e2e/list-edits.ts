// Seam 1 helper: the parent publishes a new version of a list while the app is installed on the device.
//
// The fixture site serves fixed content, so a test stands in for "the parent published a change" by
// making the site answer later requests for the list (and the manifest's item count for it) with an
// edited copy. Everything goes through the public surface the app itself uses: HTTP. The next load of
// the app (a reload, or leaving and reopening) sees the edit; loads before the call are unaffected.
import type { Page } from '@playwright/test';
import type { ListData, Manifest } from '../../src/content/types.ts';

/** From now on the site serves `edit(original)` for this list. Call again to replace the edit. */
export async function publishListEdit(page: Page, listId: string, edit: (list: ListData) => ListData): Promise<void> {
  await page.route(`**/content/lists/${listId}.*.json`, async (route) => {
    const original = (await (await route.fetch()).json()) as ListData;
    await route.fulfill({ json: edit(original) });
  });
  await page.route('**/content/manifest.json', async (route) => {
    const manifest = (await (await route.fetch()).json()) as Manifest;
    for (const subject of manifest.subjects) {
      for (const type of subject.practiceTypes) {
        for (const list of type.lists) {
          if (list.id !== listId) continue;
          const original = (await (await route.fetch({ url: new URL(list.file, route.request().url()).href })).json()) as ListData;
          list.itemCount = edit(original).items.length;
        }
      }
    }
    await route.fulfill({ json: manifest });
  });
}
