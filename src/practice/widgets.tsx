// Small pieces shared by the practice screen and the home screen's Keep going card.

export function StarBar({ done, total }: { done: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div class="starbar">
      <div
        class="starbar__track"
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div class="starbar__fill" style={{ width: `${percent}%` }} />
      </div>
      <span class="starbar__text" data-testid="progress-text">
        {done} / {total}
      </span>
    </div>
  );
}

/** Shown once the round is past the first one. */
export function RoundBadge({ index }: { index: number }) {
  if (index <= 1) return null;
  return (
    <span class="round-badge" data-testid="round-badge" role="img" aria-label={`Round ${index}`}>
      <span aria-hidden="true">🔁 {index}</span>
    </span>
  );
}
