// The small dot that tells a grown-up an update is waiting (on the Home gear and the What's new menu entry).
// Decorative: each place that shows it puts "update waiting" in its own accessible name.

export function UpdateDot() {
  return <span class="update-dot" data-testid="update-dot" aria-hidden="true" />;
}
