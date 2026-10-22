// Reading the release log against the release this build is.
import type { Release } from './content/types.ts';

/** How a release in the list relates to the installed one: it is the installed one, or it is newer. Older ones carry no marker. */
export type ReleaseMarker = 'installed' | 'update-available';

export interface MarkedRelease {
  release: Release;
  marker?: ReleaseMarker;
}

/**
 * The log (newest first) with the installed release marked and every release above it flagged as an update.
 * Undefined when the installed release is not in the log (or there is no log): then nothing can be said about
 * what is newer, so the caller shows what it can instead.
 */
export function markReleases(log: Release[] | undefined, installedId: string): MarkedRelease[] | undefined {
  const installedAt = log?.findIndex((release) => release.id === installedId) ?? -1;
  if (!log || installedAt < 0) return undefined;
  return log.map((release, index) => ({
    release,
    ...(index < installedAt && { marker: 'update-available' as const }),
    ...(index === installedAt && { marker: 'installed' as const }),
  }));
}
