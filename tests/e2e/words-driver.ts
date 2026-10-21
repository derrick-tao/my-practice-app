// Seam 1 helpers for the Word problems ("Stories") practice screen. A story is random, so the driver does what a
// child does: it reads the story on screen and works out the answer itself. `parseStory` is deliberately written from
// the stories' English alone (one pattern per kind of story), never from the app's own generator, so a story whose
// stated answer or wording is wrong fails here instead of agreeing with itself.
import type { Locator, Page } from '@playwright/test';
import { expect, type AudioProbe } from './harness.ts';
import { tapNumber } from './parent-driver.ts';

export type StoryKind =
  | 'add-result'
  | 'add-change'
  | 'add-start'
  | 'take-result'
  | 'take-change'
  | 'take-start'
  | 'together-total'
  | 'apart-part'
  | 'compare-difference'
  | 'compare-bigger'
  | 'compare-smaller';

export const STORY_KINDS: StoryKind[] = [
  'add-result',
  'add-change',
  'add-start',
  'take-result',
  'take-change',
  'take-start',
  'together-total',
  'apart-part',
  'compare-difference',
  'compare-bigger',
  'compare-smaller',
];

/** The kinds whose story is an adding one (the rest take away or find a difference). */
export const ADDING_KINDS: StoryKind[] = ['add-result', 'add-change', 'add-start', 'together-total', 'compare-bigger'];

export interface Story {
  text: string;
  kind: StoryKind;
  answer: number;
  /** The numbers written in the story, in the order they are read. */
  shown: number[];
  /** The name the story is mostly about, and the second person if there is one. */
  name: string;
  friend?: string;
  object: string;
}

const SHE = ['Mia', 'Ava', 'Zoe', 'Ella', 'Lily', 'Ruby'];
const HE = ['Leo', 'Sam', 'Max', 'Noah', 'Ben', 'Jack'];
/** What the story says for this name: "She" or "He". */
const pronounOf = (name: string): 'She' | 'He' | undefined => (SHE.includes(name) ? 'She' : HE.includes(name) ? 'He' : undefined);

const NAME = '(?<name>[A-Z][a-z]+)';
const NUM = (group: string): string => `(?<${group}>\\d+)`;

interface Pattern {
  kind: StoryKind;
  /** "O" stands for the object's emoji (see `parseStory`); the pronouns are checked separately. */
  regex: RegExp;
  /** The numbers in reading order, and the answer worked out from them. */
  work(g: Record<string, string>): { shown: number[]; answer: number };
}

const num = (g: Record<string, string>, key: string): number => Number(g[key]);

// Each pattern is the whole story, word for word.
const PATTERNS: Pattern[] = [
  {
    kind: 'add-result',
    regex: new RegExp(`^${NAME} has ${NUM('x')} O\\. (?:She|He) gets ${NUM('y')} more\\. How many O does (?:she|he) have now\\?$`),
    work: (g) => ({ shown: [num(g, 'x'), num(g, 'y')], answer: num(g, 'x') + num(g, 'y') }),
  },
  {
    kind: 'add-change',
    regex: new RegExp(`^${NAME} has ${NUM('x')} O\\. (?:She|He) gets some more\\. Now (?:she|he) has ${NUM('z')} O\\. How many did (?:she|he) get\\?$`),
    work: (g) => ({ shown: [num(g, 'x'), num(g, 'z')], answer: num(g, 'z') - num(g, 'x') }),
  },
  {
    kind: 'add-start',
    regex: new RegExp(`^${NAME} has some O\\. (?:She|He) gets ${NUM('y')} more\\. Now (?:she|he) has ${NUM('z')} O\\. How many did (?:she|he) have at first\\?$`),
    work: (g) => ({ shown: [num(g, 'y'), num(g, 'z')], answer: num(g, 'z') - num(g, 'y') }),
  },
  {
    kind: 'take-result',
    regex: new RegExp(`^${NAME} has ${NUM('z')} O\\. (?:She|He) gives ${NUM('y')} away\\. How many O does (?:she|he) have left\\?$`),
    work: (g) => ({ shown: [num(g, 'z'), num(g, 'y')], answer: num(g, 'z') - num(g, 'y') }),
  },
  {
    kind: 'take-change',
    regex: new RegExp(`^${NAME} has ${NUM('z')} O\\. (?:She|He) gives some away\\. Now (?:she|he) has ${NUM('x')} O left\\. How many did (?:she|he) give away\\?$`),
    work: (g) => ({ shown: [num(g, 'z'), num(g, 'x')], answer: num(g, 'z') - num(g, 'x') }),
  },
  {
    kind: 'take-start',
    regex: new RegExp(`^${NAME} has some O\\. (?:She|He) gives ${NUM('y')} away\\. Now (?:she|he) has ${NUM('x')} O left\\. How many did (?:she|he) have at first\\?$`),
    work: (g) => ({ shown: [num(g, 'y'), num(g, 'x')], answer: num(g, 'x') + num(g, 'y') }),
  },
  {
    kind: 'together-total',
    regex: new RegExp(`^${NAME} has ${NUM('x')} O\\. (?<friend>[A-Z][a-z]+) has ${NUM('y')} O\\. How many O do they have in all\\?$`),
    work: (g) => ({ shown: [num(g, 'x'), num(g, 'y')], answer: num(g, 'x') + num(g, 'y') }),
  },
  {
    kind: 'apart-part',
    regex: new RegExp(`^${NAME} has ${NUM('z')} O\\. (?:She|He) puts ${NUM('x')} in a box and the rest in a bag\\. How many O are in the bag\\?$`),
    work: (g) => ({ shown: [num(g, 'z'), num(g, 'x')], answer: num(g, 'z') - num(g, 'x') }),
  },
  {
    kind: 'compare-difference',
    regex: new RegExp(`^${NAME} has ${NUM('z')} O\\. (?<friend>[A-Z][a-z]+) has ${NUM('x')} O\\. How many more O does \\k<name> have than \\k<friend>\\?$`),
    work: (g) => ({ shown: [num(g, 'z'), num(g, 'x')], answer: num(g, 'z') - num(g, 'x') }),
  },
  {
    // The first person in this story is the smaller one; the story is about the second.
    kind: 'compare-bigger',
    regex: new RegExp(`^(?<friend>[A-Z][a-z]+) has ${NUM('x')} O\\. ${NAME} has ${NUM('y')} more O than \\k<friend>\\. How many O does \\k<name> have\\?$`),
    work: (g) => ({ shown: [num(g, 'x'), num(g, 'y')], answer: num(g, 'x') + num(g, 'y') }),
  },
  {
    kind: 'compare-smaller',
    regex: new RegExp(`^${NAME} has ${NUM('z')} O\\. That is ${NUM('y')} more than (?<friend>[A-Z][a-z]+) has\\. How many O does \\k<friend> have\\?$`),
    work: (g) => ({ shown: [num(g, 'z'), num(g, 'y')], answer: num(g, 'z') - num(g, 'y') }),
  },
];

const EMOJI = /\p{Extended_Pictographic}/gu;

/** Read a story the way a child would, and work out its answer. Throws for text that is none of the known stories. */
export function parseStory(text: string): Story {
  const objects = text.match(EMOJI) ?? [];
  const object = objects[0];
  if (object === undefined || objects.some((emoji) => emoji !== object)) {
    throw new Error(`a story names one object (one emoji), repeated: ${text}`);
  }
  const normalised = text.replace(EMOJI, 'O').replace(/\s+/g, ' ').trim();
  for (const { kind, regex, work } of PATTERNS) {
    const groups = regex.exec(normalised)?.groups;
    if (!groups) continue;
    const { shown, answer } = work(groups as Record<string, string>);
    const { name, friend } = groups as { name: string; friend?: string };
    if (!Number.isInteger(answer) || answer < 1) throw new Error(`no sensible answer (${answer}): ${text}`);
    if (friend === name) throw new Error(`the same name twice: ${text}`);
    // Every "she" or "he" is the one that goes with the person the story is about.
    const subject = name;
    const said = [...normalised.matchAll(/\b(She|He|she|he)\b/g)].map((m) => m[1]!.toLowerCase());
    const expected = pronounOf(subject);
    if (expected === undefined) throw new Error(`unknown name ${subject}: ${text}`);
    if (said.some((word) => word !== expected.toLowerCase())) throw new Error(`pronoun does not fit ${subject}: ${text}`);
    return { text, kind, answer, shown, name, ...(friend !== undefined && { friend }), object };
  }
  throw new Error(`not a story the app should tell: ${text}`);
}

/** The same story told twice has the same kind and numbers ("together" stories read either way round). */
export const identityOf = (story: Story): string =>
  `${story.kind}:${(story.kind === 'together-total' ? [...story.shown].sort((a, b) => a - b) : story.shown).join(',')}`;

/** The picture rows a story should show: one row of the object per number in the story that is 10 or less, in reading order. */
export const expectedPictures = (story: Story): string[] =>
  story.shown.filter((count) => count <= 10).map((count) => story.object.repeat(count));

/** The equation a worked answer ends with: "8 + 3 = 11". Gives its parts when it adds up, else undefined. */
export function finalEquation(strategy: string): { a: number; op: '+' | '−'; b: number; result: number } | undefined {
  const match = /(\d+) ([+−]) (\d+) = (\d+)$/.exec(strategy.trim());
  if (!match) return undefined;
  const a = Number(match[1]);
  const b = Number(match[3]);
  const op = match[2] as '+' | '−';
  const result = Number(match[4]);
  return (op === '+' ? a + b : a - b) === result ? { a, op, b, result } : undefined;
}

export class StoriesScreen {
  readonly problem: Locator;
  readonly pictures: Locator;
  readonly pictureRows: Locator;
  readonly feedback: Locator;
  readonly strategy: Locator;
  readonly answerBox: Locator;
  readonly next: Locator;
  readonly progress: Locator;
  readonly summary: Locator;
  readonly retry: Locator;
  readonly completion: Locator;
  readonly roundBadge: Locator;
  readonly breakPrompt: Locator;
  readonly keepOn: Locator;
  readonly keepGoing: Locator;
  readonly undo: Locator;

  constructor(
    readonly page: Page,
    readonly audio: AudioProbe,
  ) {
    this.problem = page.getByTestId('problem');
    this.pictures = page.getByTestId('pictures');
    this.pictureRows = page.getByTestId('picture-row');
    this.feedback = page.getByTestId('feedback');
    this.strategy = page.getByTestId('strategy');
    this.answerBox = page.getByTestId('answer');
    this.next = page.getByRole('button', { name: 'Next', exact: true });
    this.progress = page.getByTestId('progress-text');
    this.summary = page.getByTestId('round-summary');
    this.retry = page.getByRole('button', { name: /Practice the .* problems/ });
    this.completion = page.getByTestId('completion');
    this.roundBadge = page.getByTestId('round-badge');
    this.breakPrompt = page.getByTestId('break-prompt');
    this.keepOn = page.getByRole('button', { name: 'Keep going' });
    this.keepGoing = page.getByRole('link', { name: /Keep going/ });
    this.undo = page.getByRole('button', { name: 'Undo' });
  }

  /** Home -> the lesson's Stories button. */
  async open(lessonTitle: string): Promise<void> {
    await this.page.goto('./');
    await this.page.getByRole('group', { name: lessonTitle, exact: true }).getByRole('link', { name: /Stories ·/ }).click();
  }

  /** Close and reopen the app (a fresh load of home), then tap Keep going. */
  async reopenViaKeepGoing(): Promise<void> {
    await this.page.goto('./');
    await this.page.reload();
    await this.keepGoing.click();
  }

  /** The story on screen, read and solved. Waits for one to show; a break prompt on the way is answered with Keep going. */
  async read(): Promise<Story> {
    await expect(this.problem.or(this.breakPrompt)).toBeVisible();
    if (await this.breakPrompt.isVisible()) await this.keepOn.click();
    await expect(this.problem).toBeVisible();
    return parseStory(((await this.problem.textContent()) ?? '').trim());
  }

  /** The picture rows on screen, as the emoji they show (none when no number in the story is 10 or less). */
  async pictureRowTexts(): Promise<string[]> {
    return (await this.pictureRows.allTextContents()).map((text) => text.replace(/\s+/g, ''));
  }

  async submit(value: number): Promise<void> {
    await tapNumber(this.page, value);
    await this.page.getByRole('button', { name: 'Check', exact: true }).click();
  }

  async progressNumber(): Promise<number> {
    await expect(this.progress).toBeVisible();
    return Number(((await this.progress.textContent()) ?? '').split('/')[0]!.trim());
  }

  /** Wait until the learner is past problem number `before` (the next story shows, or the round ended and the progress bar went). */
  private async waitPast(before: number): Promise<void> {
    await expect
      .poll(async () => (await this.progress.count()) === 0 || !((await this.progress.textContent()) ?? '').startsWith(`${before} /`))
      .toBe(true);
  }

  async answerWrong(): Promise<Story> {
    const story = await this.read();
    await this.submit(story.answer + 1);
    return story;
  }

  /** Right on the first try, then wait for the next story or the end of the round. */
  async solveFirstTry(): Promise<Story> {
    const story = await this.read();
    const before = await this.progressNumber();
    await this.submit(story.answer);
    await this.waitPast(before);
    return story;
  }

  /**
   * Play the round to its end. `howToSolve(story, index)` picks how each story goes: 'first', 'second' or 'missed'.
   * A missed story's shown answer and worked equation are checked on the way (`onMissed`). Break prompts get Keep going.
   * Returns the stories in the order shown.
   */
  async playRound(
    howToSolve: (story: Story, index: number) => 'first' | 'second' | 'missed' = () => 'first',
    onMissed?: (story: Story, strategy: string) => void,
  ): Promise<Story[]> {
    const shown: Story[] = [];
    for (;;) {
      await expect(this.problem.or(this.summary).or(this.completion).or(this.breakPrompt)).toBeVisible();
      if (await this.breakPrompt.isVisible()) {
        await this.keepOn.click();
        continue;
      }
      if (!(await this.problem.isVisible())) return shown;
      const story = await this.read();
      const how = howToSolve(story, shown.length);
      shown.push(story);
      if (how === 'first') {
        const before = await this.progressNumber();
        await this.submit(story.answer);
        await this.waitPast(before);
      } else if (how === 'second') {
        await this.submit(story.answer + 1);
        await expect(this.feedback).toContainText('Try again');
        await this.submit(story.answer);
        await expect(this.feedback).toContainText('got it!');
        await this.next.click();
      } else {
        await this.submit(story.answer + 1);
        await expect(this.feedback).toContainText('Try again');
        await this.submit(story.answer + 1);
        await expect(this.feedback).toHaveText(`The answer is ${story.answer}`);
        await expect(this.strategy).toBeVisible();
        onMissed?.(story, ((await this.strategy.textContent()) ?? '').trim());
        await this.next.click();
      }
    }
  }
}
