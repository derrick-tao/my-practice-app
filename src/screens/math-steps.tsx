// A multi-step math problem (Strategies): the given line, then one line per step reached so far. A finished step stays
// on screen with its answer, and only the step the child is on has a blank to fill, so the lines read as the worked trick.
import type { StepPlace } from '../practice/math-session.ts';

export function StepsProblem({ given, place, settled, entry }: { given: string; place: StepPlace; settled: boolean; entry: string }) {
  return (
    <div class="math__steps" data-testid="problem">
      {given !== '' && (
        <p class="math__given" data-testid="given">
          {given}
        </p>
      )}
      {place.steps.slice(0, place.index + 1).map((step, i) => {
        const current = i === place.index;
        return (
          <p class={current ? 'math__step math__step--current' : 'math__step'} data-testid="step" key={i}>
            {step.before}
            <span class="math__answer" data-testid={current ? 'answer' : undefined}>
              {current && !settled ? (entry === '' ? '?' : entry) : step.answer}
            </span>
            {step.after}
          </p>
        );
      })}
    </div>
  );
}
