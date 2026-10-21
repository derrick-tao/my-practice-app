// The math pieces of the parent area, kept apart from the Chinese ones in progress.tsx and lesson-preview.tsx.
// Everything here goes through the MathPracticeType interface (src/math/types.ts) and the registry, so a math
// practice type added later shows up without a change here.
import { useRef, useState } from 'preact/hooks';
import type { RulesTypeId } from '../content/types.ts';
import { kindLabel } from '../math/kind-label.ts';
import { MATH_TYPES } from '../math/index.ts';
import { rulesSummary, type Rules } from '../math/rules.ts';
import { sampleProblems } from '../math/samples.ts';
import { createRandomSource } from '../practice/random.ts';
import { enteredAnswers, type KindTally, type MissedProblem } from '../practice/math-progress.ts';
import { PRACTICE_TYPES } from '../practice/practice-types.tsx';
import './math-parent.css';

/** A math practice type in the lesson preview: its rules, its problem kinds, and 5 sample problems with a 🔀 for new ones. */
export function MathPreviewSection({ typeId, rules }: { typeId: RulesTypeId; rules: Rules }) {
  const type = PRACTICE_TYPES[typeId];
  const math = MATH_TYPES[typeId];
  // One random source for the section's life: pressing 🔀 keeps drawing from it, so the next samples differ even in the seeded e2e build.
  const random = useRef(createRandomSource());
  const [samples, setSamples] = useState(() => sampleProblems(math, rules, random.current));
  return (
    <section class="preview-section" data-testid="preview-section">
      <h3 class="preview-section__title">
        <span aria-hidden="true">{type.icon} </span>
        {type.label}
      </h3>
      <p class="preview-rules" data-testid="preview-rules">
        New problems every time: {rulesSummary(rules)}
      </p>
      <ul class="preview-kinds" aria-label="Problem kinds">
        {math.kinds(rules).map((kind) => (
          <li key={kind} class="preview-kind" data-testid="preview-kind">
            {kindLabel(kind)}
          </li>
        ))}
      </ul>
      <ol class="preview-samples" aria-label="Sample problems">
        {samples.map((problem, index) => (
          <li key={index} class="preview-sample" data-testid="preview-sample">
            <span class="preview-sample__problem">{math.equation(problem)} ?</span>
            <span class="preview-sample__answer">Answer: {math.answer(problem)}</span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        class="preview-samples__shuffle"
        aria-label="New samples"
        onClick={() => setSamples(sampleProblems(math, rules, random.current))}
      >
        <span aria-hidden="true">🔀</span>
      </button>
    </section>
  );
}

/** Trickiest problem kinds: ❌ counts out of the problems of that kind, across every attempt. */
export function TrickiestKinds({ tally }: { tally: KindTally[] }) {
  if (tally.length === 0) return null;
  return (
    <>
      <h4 class="progress-heading">Trickiest problem kinds</h4>
      <ol class="progress-list progress-tricky">
        {tally.map(({ kind, wrong, total }) => (
          <li key={kind} class="progress-tricky__row" data-testid="tricky-kind">
            <span class="progress-tricky__kind">{kindLabel(kind)}</span>
            <span class="progress-tricky__count">
              <span aria-hidden="true">❌ </span>
              {wrong} of {total}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

/** A round's ❌ problems: the problem as the child saw it and what was entered ("13 − 4 = ?", answered 8). */
export function MissedProblems({ typeId, missed }: { typeId: RulesTypeId; missed: MissedProblem[] }) {
  const math = MATH_TYPES[typeId];
  return (
    <div class="progress-round__missed">
      {missed.map(({ spot, problem, tries }) => (
        <span key={spot} class="progress-missed-problem" data-testid="missed-problem">
          {problem ? (
            <>
              <span class="progress-missed-problem__equation">{math.equation(problem)} ?</span>
              <span class="progress-missed-problem__answered">{enteredAnswers(tries)}</span>
            </>
          ) : (
            <span class="progress-char">Problem {spot}</span>
          )}
        </span>
      ))}
    </div>
  );
}
