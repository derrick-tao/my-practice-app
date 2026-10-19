// Seam 1: parent gate, first-run setup, and assigned lessons (ticket 07).
import { expect, test } from './harness.ts';
import { lessonGroup, PracticeScreen } from './practice-driver.ts';
import {
  failGate,
  gateFactors,
  openParentArea,
  openParentSection,
  passGate,
  setUpLearner,
  tapNumber,
} from './parent-driver.ts';
import { savedDataFixture, seedSavedData } from './saved-data.ts';

test.describe('first run', () => {
  test('asks for a grown-up, then gate -> profile -> assign one of two lessons -> home greets with the avatar and shows only that lesson', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { name: /Hi! Ask a grown-up to set up/ })).toBeVisible();
    // Nothing of the child's home yet.
    await expect(page.getByRole('link', { name: /Fixture/ })).toHaveCount(0);

    await page.getByRole('button', { name: /grown-up/i }).click();
    await passGate(page);

    await page.getByRole('textbox', { name: 'Name' }).fill('Mia');
    await page.getByRole('button', { name: '🐼', exact: true }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByRole('switch', { name: /Fixture Three/ }).click();
    await expect(page.getByRole('switch', { name: /Fixture Three/ })).toBeChecked();
    await expect(page.getByRole('switch', { name: /Fixture Five/ })).not.toBeChecked();
    await page.getByRole('button', { name: 'Done' }).click();

    await expect(page.getByRole('heading', { name: 'Hi 🐼 Mia!' })).toBeVisible();
    const card = lessonGroup(page, 'Fixture Three');
    await expect(card).toContainText('Test: 2026-11-02 to 2026-11-06');
    await expect(card).toContainText('3 characters');
    await expect(lessonGroup(page, 'Fixture Five')).toHaveCount(0);

    // The profile is saved on the device: a fresh load goes straight to home.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Hi 🐼 Mia!' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Fixture Three/ })).toBeVisible();
  });

  test('setUpLearner (the shared helper) gets to the home screen with the chosen name, avatar and lessons', async ({
    page,
  }) => {
    await setUpLearner(page, { name: 'Leo', avatar: '🦊', lessons: ['fixture-five'] });

    await expect(page.getByRole('heading', { name: 'Hi 🦊 Leo!' })).toBeVisible();
    await expect(lessonGroup(page, 'Fixture Five')).toBeVisible();
    await expect(page.getByRole('link', { name: /Fixture Three/ })).toHaveCount(0);
  });

  test('a practice in progress from before profiles existed is kept by the first profile', async ({
    page,
    audio,
    loadLesson,
  }) => {
    await page.goto('./');
    await seedSavedData(page, savedDataFixture('schema-v1') as Parameters<typeof seedSavedData>[1]);
    await setUpLearner(page, { name: 'Zoe', avatar: '🦁' });

    const practice = new PracticeScreen(page, audio, await loadLesson('fixture-three'));
    await expect(practice.keepGoing).toBeVisible();
    await expect(practice.keepGoing.getByTestId('round-badge')).toHaveAttribute('aria-label', 'Round 2');
    await practice.keepGoing.click();
    await expect(practice.check).toBeVisible();
    expect(await practice.reveal()).toBe('分');
  });

  test('a brand-new device is sent to set-up from any address', async ({ page }) => {
    await page.goto('./#/chinese/dictation/fixture-three');
    await expect(page.getByRole('heading', { name: /Ask a grown-up to set up/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Listen' })).toHaveCount(0);

    await page.goto('./#/parent');
    await expect(page.getByRole('heading', { name: /Ask a grown-up to set up/ })).toBeVisible();
  });

  test('quitting before Done saves nothing: the next visit starts set-up again', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: /grown-up/i }).click();
    await passGate(page);
    await page.getByRole('textbox', { name: 'Name' }).fill('Mia');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('switch', { name: /Fixture Three/ }).click();

    await page.reload();
    await expect(page.getByRole('heading', { name: /Ask a grown-up to set up/ })).toBeVisible();
  });

  test('set-up needs a name and at least one lesson; a failed save of Done can be retried', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: /grown-up/i }).click();
    await passGate(page);
    const next = page.getByRole('button', { name: 'Next' });
    await expect(next).toBeDisabled();
    await page.getByRole('textbox', { name: 'Name' }).fill('   ');
    await expect(next).toBeDisabled();
    await page.getByRole('textbox', { name: 'Name' }).fill('Mia');
    await next.click();

    const done = page.getByRole('button', { name: 'Done' });
    await expect(done).toBeDisabled();
    await page.getByRole('switch', { name: /Fixture Five/ }).click();
    await page.evaluate(() => void (window.__failStorageWrites = true));
    await done.click();
    await expect(page.getByRole('alert')).toContainText("Couldn't save");
    await expect(page.getByRole('heading', { name: 'Hi 🐼 Mia!' })).toHaveCount(0);

    await page.evaluate(() => void (window.__failStorageWrites = false));
    await done.click();
    await expect(page.getByRole('heading', { name: 'Hi 🐼 Mia!' })).toBeVisible();
  });

  test('the name never appears in any network request, however it is used', async ({ page, audio, loadLesson }) => {
    const sent: string[] = [];
    page.on('request', (request) => sent.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`));

    await setUpLearner(page, { name: 'Zebulon Quimby' });
    const practice = new PracticeScreen(page, audio, await loadLesson('fixture-three'));
    await practice.open();
    await practice.reveal();
    await practice.gotIt.click();
    await practice.home.click();
    await openParentArea(page);
    await openParentSection(page, /Assign lessons/);
    await page.reload();

    expect(sent.length).toBeGreaterThan(5);
    const lowered = sent.join('\n').toLowerCase();
    for (const secret of ['zebulon', 'quimby', encodeURIComponent('Zebulon Quimby').toLowerCase()]) {
      expect(lowered).not.toContain(secret);
    }
  });
});

test.describe('parent gate', () => {
  test('a wrong answer gives a new question; a right answer opens the parent area', async ({ page }) => {
    await setUpLearner(page);
    await page.getByRole('link', { name: 'Parent area' }).click();
    // Behind the gate: nothing of the parent area yet.
    await expect(page.getByTestId('gate-question')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Grown-ups', exact: true })).toHaveCount(0);

    for (let attempt = 0; attempt < 3; attempt++) {
      const before = await page.getByTestId('gate-question').textContent();
      await failGate(page);
      await expect(page.getByRole('status')).toContainText('new one');
      await expect(page.getByTestId('gate-question')).not.toHaveText(before!);
      await expect(page.getByTestId('gate-answer')).toHaveText('?'); // the entry was cleared
      await expect(page.getByRole('heading', { name: 'Grown-ups', exact: true })).toHaveCount(0);
    }

    await passGate(page);
    await expect(page.getByRole('heading', { name: 'Grown-ups', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Assign lessons/ })).toBeVisible();
  });

  test('asks only multiplications of 6 to 9, answered on an on-screen number pad that can delete', async ({
    page,
  }) => {
    await setUpLearner(page);
    await page.getByRole('link', { name: 'Parent area' }).click();
    for (let i = 0; i < 6; i++) {
      const [a, b] = await gateFactors(page);
      expect([a, b].every((n) => n >= 6 && n <= 9)).toBe(true);
      await failGate(page);
    }
    const [a, b] = await gateFactors(page);
    await tapNumber(page, 1);
    await tapNumber(page, 2);
    await expect(page.getByTestId('gate-answer')).toHaveText('12');
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByTestId('gate-answer')).toHaveText('1');
    await page.getByRole('button', { name: 'Delete' }).click();
    await tapNumber(page, a * b);
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Grown-ups', exact: true })).toBeVisible();
  });

  test('going straight to a parent area address still asks the gate, and lands where the address points', async ({
    page,
  }) => {
    await setUpLearner(page);
    await page.goto('./#/parent/assign-lessons');
    await expect(page.getByTestId('gate-question')).toBeVisible();
    await expect(page.getByRole('switch')).toHaveCount(0);
    await passGate(page);
    await expect(page.getByRole('switch', { name: /Fixture Three/ })).toBeVisible();
  });

  test('leaving the parent area (Home, or the back button) locks the gate again', async ({ page }) => {
    await setUpLearner(page);
    await openParentArea(page);

    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('heading', { name: 'Hi 🐼 Mia!' })).toBeVisible();
    await page.getByRole('link', { name: 'Parent area' }).click();
    await expect(page.getByTestId('gate-question')).toBeVisible();

    await passGate(page);
    await openParentSection(page, /Assign lessons/);
    await expect(page.getByRole('switch', { name: /Fixture Three/ })).toBeVisible();
    await page.goBack(); // to the section lesson: still inside the parent area
    await expect(page.getByRole('heading', { name: 'Grown-ups', exact: true })).toBeVisible();
    await page.goBack(); // out to home
    await expect(page.getByRole('heading', { name: 'Hi 🐼 Mia!' })).toBeVisible();
    await page.goForward();
    await expect(page.getByTestId('gate-question')).toBeVisible();
  });

  test('reloading the page locks the gate again', async ({ page }) => {
    await setUpLearner(page);
    await openParentArea(page);
    await page.reload();
    await expect(page.getByTestId('gate-question')).toBeVisible();
  });

  test('stays unlocked while in use, and locks after 5 minutes idle', async ({ page }) => {
    await page.clock.install();
    await setUpLearner(page);
    await openParentArea(page);

    await page.clock.fastForward('04:30');
    await expect(page.getByRole('heading', { name: 'Grown-ups', exact: true })).toBeVisible();
    // Using the parent area restarts the idle time...
    await openParentSection(page, /Assign lessons/);
    await page.clock.fastForward('04:30');
    await expect(page.getByRole('switch', { name: /Fixture Three/ })).toBeVisible();
    // ...and 5 minutes without a tap locks it, wherever the parent was.
    await page.clock.fastForward('00:40');
    await expect(page.getByTestId('gate-question')).toBeVisible();
    await expect(page.getByRole('switch')).toHaveCount(0);

    await passGate(page);
    await expect(page.getByRole('switch', { name: /Fixture Three/ })).toBeVisible();
  });
});

test.describe('assigned lessons', () => {
  test('unassigning a lesson hides its card on home; assigning it brings it back', async ({ page }) => {
    await setUpLearner(page);
    await expect(lessonGroup(page, 'Fixture Five')).toBeVisible();

    await openParentArea(page);
    await openParentSection(page, /Assign lessons/);
    const five = page.getByRole('switch', { name: /Fixture Five/ });
    await expect(five).toBeChecked();
    await five.click();
    await expect(five).not.toBeChecked();
    await expect(page.getByRole('switch', { name: /Fixture Three/ })).toBeChecked();
    await page.getByRole('link', { name: 'Home' }).click();

    await expect(page.getByRole('link', { name: /Fixture Three/ })).toBeVisible();
    await expect(lessonGroup(page, 'Fixture Five')).toHaveCount(0);
    await page.reload(); // saved on the device
    await expect(page.getByRole('link', { name: /Fixture Three/ })).toBeVisible();
    await expect(lessonGroup(page, 'Fixture Five')).toHaveCount(0);

    await openParentArea(page);
    await openParentSection(page, /Assign lessons/);
    await expect(five).not.toBeChecked();
    await five.click();
    await expect(five).toBeChecked();
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(lessonGroup(page, 'Fixture Five')).toBeVisible();
  });

  test('an active session on a lesson that gets unassigned still shows Keep going', async ({ page, audio, loadLesson }) => {
    await setUpLearner(page);
    const practice = new PracticeScreen(page, audio, await loadLesson('fixture-three'));
    await practice.open();
    await practice.reveal();
    await practice.gotIt.click();
    await expect(practice.progressText()).toHaveText('1 / 3');
    await expect(practice.check).toBeVisible(); // the next item's heard flag is saved
    await practice.home.click();
    await expect(practice.keepGoing).toBeVisible();

    await openParentArea(page);
    await openParentSection(page, /Assign lessons/);
    await page.getByRole('switch', { name: /Fixture Three/ }).click();
    await expect(page.getByRole('switch', { name: /Fixture Three/ })).not.toBeChecked();
    await page.getByRole('link', { name: 'Home' }).click();

    await expect(page.getByRole('heading', { name: 'Hi 🐼 Mia!' })).toBeVisible();
    await expect(practice.lessonCard()).toHaveCount(0); // no card to start it afresh...
    await expect(practice.keepGoing).toBeVisible(); // ...but the practice in progress is still there
    await expect(practice.keepGoing).toContainText('Fixture Three');
    await practice.keepGoing.click();
    await expect(practice.check).toBeVisible();
    await expect(practice.progressText()).toHaveText('1 / 3');
  });

  test('a failed save of a toggle says so and does not change it; retrying saves it', async ({ page }) => {
    await setUpLearner(page);
    await openParentArea(page);
    await openParentSection(page, /Assign lessons/);
    const five = page.getByRole('switch', { name: /Fixture Five/ });

    await page.evaluate(() => void (window.__failStorageWrites = true));
    await five.click();
    await expect(page.getByRole('alert')).toContainText("Couldn't save");
    await expect(five).toBeChecked(); // unchanged: what is shown is what is saved

    await page.evaluate(() => void (window.__failStorageWrites = false));
    await page.getByRole('button', { name: /tap to retry/ }).click();
    await expect(five).not.toBeChecked();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});
