/** A date as a grown-up reads it on the Progress and Backup screens, e.g. "Oct 8, 2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** A calendar day written `YYYY-MM-DD` (a release's date), as the same words, whatever time zone the device is in. */
export function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
