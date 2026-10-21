// A multi-step math problem (Strategies): the trick's badge on its own line, the question (the given line) on the next,
// then one line per step reached so far, each with a one-line hint. A finished step stays on screen with its answer,
// and only the step the child is on has a blank to fill, so the lines read as the worked trick.
import type { StepPlace } from '../practice/math-session.ts';
import type { TrickHelp } from '../math/types.ts';
import { MathBlank } from './math-blank.tsx';
import { TrickBadge } from './trick-help.tsx';

export function StepsProblem({
  title,
  help,
  given,
  place,
  settled,
  entry,
}: {
  /** The trick's name ("Make a ten"), shown as a badge above the question. */
  title?: string;
  /** The trick's help, opened from a "?" on the badge; without it the badge has no "?". */
  help?: TrickHelp;
  given: string;
  place: StepPlace;
  settled: boolean;
  entry: string;
}) {
  return (
    <div class="math__steps" data-testid="problem">
      {title !== undefined && <TrickBadge title={title} help={help} />}
      {given !== '' && (
        <p class="math__question" data-testid="given">
          {given}
        </p>
      )}
      {place.steps.slice(0, place.index + 1).map((step, i) => {
        const current = i === place.index;
        const open = current && !settled;
        return (
          <div class="math__line" key={i}>
            <p class={current ? 'math__step math__step--current' : 'math__step'} data-testid="step">
              {step.before}
              <MathBlank value={open ? entry : step.answer} testId={current ? 'answer' : undefined} done={!current} />
              {step.after}
            </p>
            {step.hint !== undefined && (
              <p class="math__hint" data-testid="hint">
                {step.hint}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
