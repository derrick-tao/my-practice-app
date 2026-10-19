/** A date as a grown-up reads it on the Progress and Backup screens, e.g. "Oct 8, 2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
