// The pieces every practice screen shares: the way home, the not-found notice, the break prompt, the round summary
// and the completion screen. The screens differ in what they practice, not in how a round ends.
import { Celebration } from '../practice/celebration.tsx';
import { HOME_HREF } from '../router.ts';

export function HomeButton() {
  return (
    <a class="home-button" href={HOME_HREF}>
      <span aria-hidden="true">🏠 </span>Home
    </a>
  );
}

/** The address named no lesson we have (unknown lesson, or a subject / practice type it does not belong to). */
export function LessonNotFound() {
  return (
    <main class="screen">
      <HomeButton />
      <p class="notice">We couldn't find this lesson.</p>
    </main>
  );
}

export function BreakPrompt({ onKeepGoing, onBreak }: { onKeepGoing: () => void; onBreak: () => void }) {
  return (
    <section class="break-prompt" data-testid="break-prompt">
      <p class="break-prompt__title">
        <span aria-hidden="true">🌟 </span>Great job! Take a break?
      </p>
      <div class="row row--primary">
        <button type="button" class="btn btn--primary" onClick={onKeepGoing}>
          <span aria-hidden="true">▶️ </span>Keep going
        </button>
        <button type="button" class="btn" onClick={onBreak}>
          <span aria-hidden="true">🏠 </span>Break
        </button>
      </div>
    </section>
  );
}

export function RoundSummary({
  correct,
  wrong,
  retryCount,
  noun = 'words',
  onRetry,
}: {
  correct: number;
  wrong: number;
  /** Missed words that can be practiced again (a miss on a since-removed word cannot). */
  retryCount: number;
  /** What the ❌ items are called on the retry button. */
  noun?: string;
  onRetry: () => void;
}) {
  return (
    <section class="summary" data-testid="round-summary">
      <div class="summary__counts">
        <span class="count count--good">
          <span aria-hidden="true">✅ </span>
          <span data-testid="correct-count">{correct}</span>
        </span>
        <span class="count count--bad">
          <span aria-hidden="true">❌ </span>
          <span data-testid="wrong-count">{wrong}</span>
        </span>
      </div>
      {retryCount > 0 && (
        <>
          <p class="summary__more">Let's practice {retryCount} more!</p>
          <button type="button" class="btn btn--primary btn--retry" onClick={onRetry}>
            <span aria-hidden="true">🔁 </span>Practice the ❌ {noun}
          </button>
        </>
      )}
    </section>
  );
}

export function Completion({ lines }: { lines: string[] }) {
  return (
    <section class="summary completion" data-testid="completion">
      <Celebration />
      <div class="completion__finish" aria-hidden="true">
        <svg class="completion__course" viewBox="0 0 300 90" preserveAspectRatio="xMinYMid meet" focusable="false">
          <path class="completion__path" d="M14 70 L62 28 L110 62 L158 24 L206 58 L254 30" />
          {[
            [14, 70],
            [62, 28],
            [110, 62],
            [158, 24],
            [206, 58],
          ].map(([x, y]) => (
            <g key={x} transform={`translate(${x} ${y})`}>
              <circle r="11" class="completion__stop" />
              <path class="completion__tick" d="M-5 0l3.5 4 7-9" />
            </g>
          ))}
        </svg>
        <span class="seal" lang="zh-CN">
          优
        </span>
      </div>
      <p class="completion__title">
        <span aria-hidden="true">🎉 </span>You did it!
      </p>
      {lines.map((line) => (
        <p class="completion__line">{line}</p>
      ))}
      <HomeButton />
    </section>
  );
}
