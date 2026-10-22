// Seam 1 scenario 15 (offline) and the update flow (ticket 14): a new version waits, and a grown-up applies it with
// "Update now" in the parent area's What's new section.
// These specs opt in to the service worker (the rest of Seam 1 runs with it blocked, see playwright.config.ts)
// and run against pwa-site.ts, a server that can publish a new version while the app is open.
import type { Page } from '@playwright/test';
import type { LessonData } from '../../src/content/types.ts';
import { openParentArea, openParentSection, passGate, setUpLearner } from './parent-driver.ts';
import { lessonGroup, PracticeScreen } from './practice-driver.ts';
import { lessonPath } from './harness.ts';
import { expect, NEW_TITLE, NEWER_RELEASE_ID, test, type PwaSite } from './pwa-site.ts';

/** Where every spec here starts: set up through the real first run, on home, online, with the service worker in control. */
async function startAtHome(page: Page): Promise<void> {
  await setUpLearner(page);
  await expect(page.getByRole('link', { name: /Fixture Three/ }).first()).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

async function swState(page: Page): Promise<{ waiting: boolean; installing: boolean }> {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return { waiting: !!registration?.waiting, installing: !!registration?.installing };
  });
}

test.describe('offline', () => {
  test('after one online visit a full session completes with the network off', async ({
    page,
    context,
    audio,
    request,
  }) => {
    await startAtHome(page);
    const lesson = (await (await request.get(await lessonPath(request, 'fixture-three'))).json()) as LessonData;

    await context.setOffline(true);
    await page.reload();

    const practice = new PracticeScreen(page, audio, lesson);
    await practice.open();
    const order = await practice.playRound(() => true);
    expect(order.sort()).toEqual(lesson.lists.dictation!.map((i) => i.target).sort());
    await expect(practice.completion).toBeVisible();

    // Every audio file the round asked for is served from the cache, with the range support iOS needs.
    const played = await audio.played(lesson);
    expect(played.length).toBeGreaterThan(0);
    for (const { ref } of played) {
      const result = await page.evaluate(async (url) => {
        const response = await fetch(url, { headers: { Range: 'bytes=0-9' } });
        return {
          status: response.status,
          contentRange: response.headers.get('Content-Range'),
          bytes: (await response.arrayBuffer()).byteLength,
        };
      }, `content/${ref}`);
      expect(result.status, ref).toBe(206);
      expect(result.contentRange, ref).toMatch(/^bytes 0-9\/\d+$/);
      expect(result.bytes, ref).toBe(10);
    }
  });

  test('the revealed character is drawn with the subset font with the network off', async ({
    page,
    context,
    audio,
    request,
  }) => {
    await startAtHome(page);
    const lesson = (await (await request.get(await lessonPath(request, 'fixture-three'))).json()) as LessonData;

    await context.setOffline(true);
    await page.reload();

    const practice = new PracticeScreen(page, audio, lesson);
    await practice.open();
    const target = await practice.reveal();
    await expect
      .poll(() =>
        page.evaluate((text) => {
          const faces = [...document.fonts].filter((face) => face.family.replace(/["']/g, '') === 'Practice Kai');
          return { statuses: faces.map((face) => face.status), covers: document.fonts.check('1em "Practice Kai"', text) };
        }, target),
      )
      .toEqual({ statuses: ['loaded'], covers: true });
  });

  test('Draw opens and draws strokes with the network off, and never asks another origin for stroke data', async ({
    page,
    context,
    audio,
    request,
    baseURL,
  }) => {
    // Everything the app requests, from the first run on, must stay on its own origin (no stroke data CDN).
    const origin = new URL(baseURL!).origin;
    const elsewhere: string[] = [];
    page.on('request', (req) => {
      if (/^https?:/.test(req.url()) && new URL(req.url()).origin !== origin) elsewhere.push(req.url());
    });

    await startAtHome(page);
    const lesson = (await (await request.get(await lessonPath(request, 'fixture-strokes'))).json()) as LessonData;

    await context.setOffline(true);
    await page.reload();

    const practice = new PracticeScreen(page, audio, lesson, 'stroke-order');
    await practice.open();
    await expect.poll(async () => (await practice.strokes()).total).toBeGreaterThan(0);
    await practice.drawCharacter();
    expect((await practice.strokes()).drawn).toBe((await practice.strokes()).total);
    await expect(practice.next).toBeVisible();

    // Every stroke file and the licence beside them are served from the cache.
    const refs = [...lesson.lists['stroke-order']!.map((item) => item.strokes!), 'strokes/ARPHICPL.TXT'];
    const statuses = await page.evaluate(async (urls) => Promise.all(urls.map(async (url) => (await fetch(url)).status)), refs.map((ref) => `content/${ref}`));
    expect(statuses).toEqual(statuses.map(() => 200));
    expect(elsewhere).toEqual([]);
  });

  test('every lesson, its audio and the content manifest are available offline, including after a restart', async ({
    page,
    context,
    request,
  }) => {
    await startAtHome(page);
    await context.setOffline(true);
    await page.goto('./');
    // Control: the network really is off, so a file that was never precached cannot be fetched.
    expect(await page.evaluate(() => fetch('content/lessons/never-published.json').then(() => 'served', () => 'failed'))).toBe('failed');
    for (const id of ['fixture-three', 'fixture-five']) {
      const path = await lessonPath(request, id);
      const lesson = (await (await request.get(path)).json()) as LessonData;
      const refs = lesson.lists.dictation!.flatMap((item) => [item.audio.normal, item.audio.slow]);
      const statuses = await page.evaluate(
        async (urls) => Promise.all(urls.map(async (url) => (await fetch(url)).status)),
        [path, ...refs.map((ref) => `content/${ref}`)],
      );
      expect(statuses, id).toEqual(statuses.map(() => 200));
    }
    await expect(lessonGroup(page, 'Fixture Five')).toBeVisible();
  });
});

/** The ids in the release log as a running page can read it, or null when the page gets nothing. */
function readLog(page: Page): Promise<string[] | null> {
  return page.evaluate(async () => {
    try {
      const response = await fetch('content/releases.json');
      return response.ok ? ((await response.json()) as Array<{ id: string }>).map((r) => r.id) : null;
    } catch {
      return null;
    }
  });
}

const installedRelease = (page: Page): Promise<string | undefined> => page.evaluate(() => document.documentElement.dataset.release);

test.describe('release log', () => {
  test('the app knows which release it is: the newest one in the log it was built with', async ({ page }) => {
    await startAtHome(page);
    expect(await installedRelease(page)).toBe('fixture-second');
  });

  test('online, a running old build reads the newer log that a deploy published', async ({ page, site }) => {
    await startAtHome(page);
    expect(await readLog(page)).toEqual(['fixture-second', 'fixture-first']);

    await site.deployNewVersion();

    expect(await readLog(page)).toEqual([NEWER_RELEASE_ID, 'fixture-second', 'fixture-first']);
    // The page itself is still the old build.
    expect(await installedRelease(page)).toBe('fixture-second');
  });

  test('offline, it reads the copy cached with the installed build, even after a deploy it never saw', async ({ page, context, site }) => {
    await startAtHome(page);
    await site.deployNewVersion();
    await context.setOffline(true);
    expect(await readLog(page)).toEqual(['fixture-second', 'fixture-first']);
  });

  test('offline with no cached copy, it gets nothing and nothing breaks', async ({ page, context }) => {
    await startAtHome(page);
    await page.evaluate(async () => {
      for (const name of await caches.keys()) await (await caches.open(name)).delete('content/releases.json');
    });
    await context.setOffline(true);
    expect(await readLog(page)).toBeNull();
    // The app itself is unharmed.
    await page.reload();
    await expect(page.getByRole('link', { name: /Fixture Three/ }).first()).toBeVisible();
  });
});

/** Publish a new version while the app is open, and wait until the browser has it installed and waiting. */
async function publishAndWaitForUpdate(page: Page, site: PwaSite, options?: { release?: boolean }): Promise<void> {
  await site.deployNewVersion(options);
  await page.evaluate(async () => void (await (await navigator.serviceWorker.getRegistration())!.update()));
  await expect.poll(() => swState(page)).toMatchObject({ waiting: true });
}

/** Home -> the parent gate -> What's new. */
async function openWhatsNew(page: Page): Promise<void> {
  await openParentArea(page);
  await openParentSection(page, "What's new");
  await expect(page.getByRole('heading', { name: "What's new", exact: true })).toBeVisible();
}

const updateNow = (page: Page) => page.getByRole('button', { name: 'Update now' });
const updateCard = (page: Page) => page.getByTestId('update-card');
const stillHere = (page: Page) => page.evaluate(() => (window as unknown as { __stillHere?: boolean }).__stillHere);

/** The title the served manifest gives Fixture Three, read the way a page offline would. */
function servedTitle(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const manifest = (await (await fetch('content/manifest.json')).json()) as {
      subjects: Array<{ lessons: Array<{ id: string; file: string }> }>;
    };
    const entry = manifest.subjects.flatMap((s) => s.lessons).find((l) => l.id === 'fixture-three')!;
    return ((await (await fetch(`content/${entry.file}`)).json()) as { title: string }).title;
  });
}

test.describe('updates', () => {
  test('a new version waits quietly; Home never prompts, even mid-practice; Update now in What\'s new loads the new content and keeps practice in progress', async ({
    page,
    site,
    audio,
    request,
  }) => {
    await startAtHome(page);
    const lesson = (await (await request.get(await lessonPath(request, 'fixture-three'))).json()) as LessonData;
    const prompt = page.getByRole('button', { name: /Update now|New words are ready/ });
    await expect(prompt).toHaveCount(0);

    // Mid-practice, a new version is published and the browser picks it up.
    const practice = new PracticeScreen(page, audio, lesson);
    await practice.open();
    await expect(practice.listen).toBeVisible();
    await page.evaluate(() => void ((window as unknown as { __stillHere: boolean }).__stillHere = true));
    await publishAndWaitForUpdate(page, site);

    // The practice screen is untouched: no prompt, no reload, same lesson.
    await expect(prompt).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Fixture Three', exact: true })).toBeVisible();
    expect(await stillHere(page)).toBe(true);
    await practice.reveal();
    await practice.gotIt.click();

    // Back on home there is still no prompt, and nothing has reloaded.
    await practice.home.click();
    await expect(page.getByRole('link', { name: /Fixture Three/ }).first()).toBeVisible();
    await expect(prompt).toHaveCount(0);
    expect(await stillHere(page)).toBe(true);

    // Behind the gate, What's new offers the update and says what it brings; still nothing has reloaded.
    await openWhatsNew(page);
    await expect(updateNow(page)).toBeVisible();
    await expect(updateCard(page)).toContainText('Fixture newer release');
    expect(await stillHere(page)).toBe(true);

    await updateNow(page).click();
    // The app reloads onto the new build: the gate is shut again and the new content is on home.
    await expect.poll(() => stillHere(page)).toBeUndefined();
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('link', { name: new RegExp(NEW_TITLE) }).filter({ hasNotText: 'Keep going' })).toBeVisible();
    // The practice that was in progress is still there to keep going.
    await expect(page.getByRole('group', { name: new RegExp(`Keep going: ${NEW_TITLE}`) })).toBeVisible();
    await expect(prompt).toHaveCount(0);

    // The new content now comes from the new cache, so it also works offline.
    expect(await servedTitle(page)).toBe(NEW_TITLE);

    // Nothing is waiting any more, so there is no Update now. (The fake deploy reuses the old bundle, so the page
    // still thinks the log is ahead of it; "You're up to date" is covered in whats-new.spec.ts.)
    await openWhatsNew(page);
    await expect(updateNow(page)).toHaveCount(0);
  });

  test('a deploy with no release of its own still offers Update now, with a generic line', async ({ page, site }) => {
    await startAtHome(page);
    await publishAndWaitForUpdate(page, site, { release: false });
    await openWhatsNew(page);

    await expect(updateNow(page)).toBeVisible();
    await expect(updateCard(page)).toContainText('An update is ready');
    await expect(updateCard(page)).not.toContainText('Fixture newer release');
  });

  test('Update now works even when the notes could not load', async ({ page, context, site }) => {
    await startAtHome(page);
    await publishAndWaitForUpdate(page, site);
    // Offline, with no copy of the log: the update is still installed and waiting, only the notes are gone.
    await page.evaluate(async () => {
      for (const name of await caches.keys()) await (await caches.open(name)).delete('content/releases.json');
    });
    await context.setOffline(true);
    await page.reload();
    await openWhatsNew(page);

    await expect(page.getByText("Couldn't load the latest notes")).toBeVisible();
    await expect(updateNow(page)).toBeVisible();
    await updateNow(page).click();

    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('link', { name: new RegExp(NEW_TITLE) })).toBeVisible();
  });

  test('after a deploy but before the update is applied, a lesson opens with the data its manifest names', async ({
    page,
    site,
  }) => {
    await startAtHome(page);
    await site.deployNewVersion();

    // The manifest is network-first, so a reload sees the new title; lesson data must agree with it.
    await page.reload();
    await page.getByRole('link', { name: new RegExp(NEW_TITLE) }).click();

    await expect(page.getByRole('heading', { name: NEW_TITLE, exact: true })).toBeAttached();
  });

  test('the very first install is not an update, even when WebKit delivers installed after the worker has claimed the page', async ({
    page,
  }) => {
    // Linux WebKit under load can report the first worker as `installed` after clients.claim() has already set
    // navigator.serviceWorker.controller. Reproduce that order: from the moment any worker reports `installed`,
    // the page already has a controller.
    await page.addInitScript(() => {
      let claimed = false;
      const realController = Object.getOwnPropertyDescriptor(ServiceWorkerContainer.prototype, 'controller')!.get!;
      Object.defineProperty(navigator.serviceWorker, 'controller', {
        get() {
          return realController.call(this) ?? (claimed ? Object.create(ServiceWorker.prototype) : null);
        },
      });
      const add = ServiceWorker.prototype.addEventListener;
      ServiceWorker.prototype.addEventListener = function (
        this: ServiceWorker,
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
      ) {
        if (type !== 'statechange') return add.call(this, type, listener, options);
        const wrapped = (event: Event): void => {
          if (this.state === 'installed') claimed = true;
          if (typeof listener === 'function') listener.call(this, event);
          else listener.handleEvent(event);
        };
        return add.call(this, type, wrapped, options);
      };
    });
    await startAtHome(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await expect(page.getByRole('link', { name: /Fixture Three/ }).first()).toBeVisible();
    await openWhatsNew(page);
    await expect(updateCard(page)).toContainText("You're up to date");
    await expect(updateNow(page)).toHaveCount(0);
  });

  test('Update now is not offered when nothing new was published', async ({ page }) => {
    await startAtHome(page);
    await page.evaluate(async () => void (await (await navigator.serviceWorker.getRegistration())!.update()));
    await expect(page.getByRole('link', { name: /Fixture Three/ }).first()).toBeVisible();
    expect(await swState(page)).toEqual({ waiting: false, installing: false });
    await openWhatsNew(page);
    await expect(updateCard(page)).toContainText("You're up to date");
    await expect(updateNow(page)).toHaveCount(0);
  });
});

test.describe('install tip', () => {
  test('the parent area suggests Add to Home Screen once; "Got it" hides it for good', async ({ page }) => {
    await setUpLearner(page);
    await openParentArea(page);
    const tip = page.getByTestId('install-tip');
    await expect(tip).toContainText('Add to Home Screen');
    // The child's home never shows it.
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByTestId('install-tip')).toHaveCount(0);

    await page.getByRole('link', { name: 'Parent area' }).click();
    await passGate(page);
    await page.getByRole('button', { name: 'Got it' }).click();
    await expect(tip).toHaveCount(0);

    await page.reload();
    await passGate(page);
    await expect(page.getByRole('heading', { name: 'Grown-ups', exact: true })).toBeVisible();
    await expect(tip).toHaveCount(0);
  });
});
