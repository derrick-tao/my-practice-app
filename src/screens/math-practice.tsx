// The math practice screen, for every math practice type. The learner reads a generated problem and taps the
// answer on the number pad and Check (or on True or False, for a true-or-false type). This is the file to copy
// for a new math practice type: the type itself only supplies problems, answers and strategies (src/math/), and
// everything here reads them through the MathPracticeType interface. What the screen shows follows the saved
// session alone (the problem, the tries, the phase), so a reload anywhere shows the same thing; only the digits
// being typed live in the screen.
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { LessonData, RulesTypeId } from '../content/types.ts';
import { answerText } from '../math/answer.ts';
import { MATH_TYPES } from '../math/index.ts';
import type { Problem } from '../math/problem.ts';
import type { MathPracticeType } from '../math/types.ts';
import { addDigit } from '../number-entry.ts';
import { NumberPad } from '../number-pad.tsx';
import { createEffects } from '../practice/effects.ts';
import { currentProblem, currentStep, nextProblem, outcomeOf, startMathRetryRound, submitAnswer } from '../practice/math-session.ts';
import { createSessionSync, type SyncState } from '../practice/session-sync.ts';
import {
  breakDue,
  canRetry,
  currentItemId,
  currentRound,
  isRoundOver,
  markCounts,
  resetBreakCount,
  sessionResult,
  wrongItemIds,
  type PracticeEnv,
  type Session,
} from '../practice/session.ts';
import { RoundBadge, StarBar } from '../practice/widgets.tsx';
import { HOME_HREF } from '../router.ts';
import { SaveFailed } from '../save-failed.tsx';
import { getStorage } from '../storage/index.ts';
import { TrueFalsePad } from '../true-false-pad.tsx';
import { StepsProblem } from './math-steps.tsx';
import { firstTryAndRounds } from './practice-flows.tsx';
import { BreakPrompt, Completion, HomeButton, RoundSummary } from './practice-parts.tsx';
import './math-stories.css';

const FEEDBACK = {
  'try-again': 'Not quite. Try again!',
  'second-try-right': 'You got it!',
} as const;

export function MathRun({
  lesson,
  practiceType,
  env,
  initial,
  breakEvery,
  sounds,
}: {
  lesson: Pick<LessonData, 'title'>;
  practiceType: RulesTypeId;
  env: PracticeEnv;
  initial: Session;
  /** Offer a break every this many finished problems; 0 is off (the profile's setting). */
  breakEvery: number;
  /** Play sound effects on ✅, ❌ and finishing (the profile's setting). */
  sounds: boolean;
}) {
  const type = MATH_TYPES[practiceType];
  const trueFalse = type.input === 'true-false';
  const effects = useMemo(() => createEffects(sounds), []);

  // What is shown is always what is saved: every change goes through `sync`, which saves it first.
  const [view, setView] = useState<SyncState>({ session: initial, saveFailed: false });
  const sync = useMemo(() => createSessionSync(getStorage(), initial, setView), []);
  useEffect(() => () => sync.detach(), []);
  const { session, saveFailed } = view;
  /** The digits typed for the current try. They are not saved: after a reload the try starts with an empty entry. */
  const [entry, setEntry] = useState('');

  /** Run a step that moves the learner on. Ignored while a save is running or has failed. Returns the session it will show. */
  const advance = (step: (from: Session) => Session): Session | undefined => {
    if (sync.busy()) return undefined;
    const before = sync.state().session;
    const after = step(before);
    if (after === before) return undefined;
    sync.dispatch((s) => (s === before ? after : s));
    return after;
  };

  /** Submit an answer: what was typed, or the True or False that was tapped. */
  const submit = (answer: string): void => {
    if (answer === '') return;
    const before = sync.state().session;
    const after = advance((s) => submitAnswer(s, answer, env));
    if (!after) return;
    setEntry('');
    if (after.status === 'completed') effects.play('fanfare');
    else if (outcomeOf(after) === 'missed') effects.play('gentle'); // only now: a second wrong answer
    else if (finishedFirstTry(before, after)) effects.play('chime');
  };
  const onSubmit = (): void => submit(entry);

  const onNext = (): void => {
    const after = advance((s) => nextProblem(s, env));
    if (after?.status === 'completed') effects.play('fanfare');
  };

  const onRetry = (): void => void advance((s) => startMathRetryRound(s, env));
  const onKeepGoing = (): void => void advance(resetBreakCount);

  /** Break: the prompt is answered and saved, and only then does the child go home. */
  const [leaving, setLeaving] = useState(false);
  const onBreak = (): void => {
    if (advance(resetBreakCount)) setLeaving(true);
  };
  useEffect(() => {
    if (leaving && !saveFailed && session.marksSinceBreak === 0) location.hash = HOME_HREF;
  }, [leaving, saveFailed, session.marksSinceBreak]);

  if (session.status === 'stopped') {
    // The lesson no longer offers this practice type: the session is saved as stopped.
    return (
      <main class="screen practice">
        <HomeButton />
        <h1 class="sr-only">{lesson.title}</h1>
        <p class="notice" data-testid="lesson-changed">
          <span aria-hidden="true">🌟 </span>This lesson changed — pick a lesson
        </p>
      </main>
    );
  }

  if (session.status === 'completed') {
    return (
      <main class="screen practice">
        <h1 class="sr-only">{lesson.title}</h1>
        <Completion lines={firstTryAndRounds(sessionResult(session))} />
      </main>
    );
  }

  const round = currentRound(session);
  const problem = currentProblem(session);
  const place = currentStep(session);
  const outcome = outcomeOf(session);
  const frame = problem ? blankFrame(type, problem) : { before: '', after: '', blank: '?' };
  const settled = round.phase === 'revealed';
  const onBreakPrompt = breakDue(session, breakEvery);
  const spots = new Set(round.itemIds);
  /** A type with pictures tells stories: the text, the pictures, and then the answer box. */
  const story = type.pictures !== undefined;
  const pictures = problem ? (type.pictures?.(problem) ?? []) : [];
  const answerBox = problem && (
    <span class="math__answer" data-testid="answer">
      {settled ? answerText(type, problem) : entry === '' ? frame.blank : entry}
    </span>
  );

  return (
    <main class="screen practice">
      <header class="practice__top">
        <HomeButton />
        <RoundBadge index={round.index} />
        <StarBar done={round.position} total={round.itemIds.length} />
      </header>
      {saveFailed && <SaveFailed onRetry={sync.retry} />}
      <h1 class="sr-only">{lesson.title}</h1>
      {onBreakPrompt && <BreakPrompt onKeepGoing={onKeepGoing} onBreak={onBreak} />}
      {!onBreakPrompt && problem && place && !isRoundOver(round) && (
        <section class="practice__body" key={`${round.index}:${currentItemId(round)}`}>
          <div class="practice__stage">
            <div class={`math${story ? ' math--story' : ''}${outcome === 'try-again' ? ' math--wobble' : ''}`}>
              {type.steps ? (
                <StepsProblem given={type.equation(problem)} place={place} settled={settled} entry={entry} />
              ) : story ? (
                <>
                  <p class="math__problem math__problem--story" data-testid="problem">
                    {type.equation(problem)}
                  </p>
                  {pictures.length > 0 && (
                    <div class="math__pictures" data-testid="pictures" aria-hidden="true">
                      {pictures.map((row, i) => (
                        <p class="math__picture-row" data-testid="picture-row" key={i}>
                          {row}
                        </p>
                      ))}
                    </div>
                  )}
                  <p class="math__problem">{answerBox}</p>
                </>
              ) : (
                <p class={trueFalse ? 'math__problem math__problem--equation' : 'math__problem'} data-testid="problem">
                  {frame.before}
                  {(!trueFalse || settled) && answerBox}
                  {frame.after}
                </p>
              )}
              {outcome && (
                <p class="math__feedback" role="status" data-testid="feedback">
                  {outcome === 'missed' ? `The answer is ${type.steps ? place.step.answer : answerText(type, problem)}` : FEEDBACK[outcome]}
                </p>
              )}
              {outcome === 'missed' && (
                <p class="math__strategy" data-testid="strategy">
                  {place.step.explanation}
                </p>
              )}
            </div>
          </div>
          <div class="practice__controls">
            {settled ? (
              <div class="row row--primary">
                <button type="button" class="btn btn--primary btn--good" onClick={onNext}>
                  <span aria-hidden="true">➡️ </span>Next
                </button>
              </div>
            ) : trueFalse ? (
              <TrueFalsePad onAnswer={submit} />
            ) : (
              <NumberPad
                onDigit={(digit) => setEntry((current) => addDigit(current, digit))}
                onDelete={() => setEntry((current) => current.slice(0, -1))}
                onSubmit={onSubmit}
                submitLabel="Check"
              />
            )}
          </div>
        </section>
      )}
      {isRoundOver(round) && (
        <RoundSummary
          {...markCounts(round)}
          retryCount={canRetry(session, spots) ? wrongItemIds(round, spots).length : 0}
          noun="problems"
          onRetry={onRetry}
        />
      )}
    </main>
  );
}

/** Where the learner's digits go: after the equation (Facts) or in the blank of a type that has a `frame`. */
function blankFrame(type: MathPracticeType, problem: Problem): { before: string; after: string; blank: string } {
  return type.frame?.(problem) ?? { before: `${type.equation(problem)} `, after: '', blank: '?' };
}

/** The submitted answer settled the problem as ✅ at the first try (the step from `before` to `after`). */
function finishedFirstTry(before: Session, after: Session): boolean {
  const was = currentRound(before);
  const id = currentItemId(was);
  const now = after.rounds.find((round) => round.index === was.index);
  return id !== undefined && now?.marks[id] === 'correct' && was.marks[id] === undefined;
}
