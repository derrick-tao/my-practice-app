// Parent area section: the release log under a card that applies a waiting update. The log is read network
// first (so an old app can preview a newer release's notes), falling back to the copy the device last saw.
import { fetchReleases } from '../../content/client.ts';
import type { Release } from '../../content/types.ts';
import { formatDay } from '../../format-date.ts';
import { markReleases, type MarkedRelease, type ReleaseMarker } from '../../release-log.ts';
import { applyUpdate, useUpdateReady } from '../../pwa/service-worker.ts';
import { useLoad } from '../../use-async.ts';
import { INSTALLED_RELEASE, INSTALLED_RELEASE_ID } from '../../version.ts';
import type { ParentSection } from '../sections.ts';
import './whats-new.css';

const MARKER_LABELS: Record<ReleaseMarker, string> = { installed: 'Installed', 'update-available': 'Update available' };

function ReleaseEntry({ release, marker, open }: MarkedRelease & { open: boolean }) {
  return (
    <li class="whats-new__release">
      <details open={open}>
        <summary>
          <span class="whats-new__title" data-testid="release-title">
            {release.title}
          </span>
          <span class="whats-new__date">{formatDay(release.date)}</span>
          {marker && <span class={`whats-new__marker whats-new__marker--${marker}`}>{MARKER_LABELS[marker]}</span>}
        </summary>
        <ul class="whats-new__bullets">
          {release.bullets.map((bullet, index) => (
            <li key={index}>{bullet}</li>
          ))}
        </ul>
      </details>
    </li>
  );
}

function ReleaseList({ entries }: { entries: MarkedRelease[] }) {
  return (
    <ul class="whats-new__releases">
      {entries.map((entry, index) => (
        <ReleaseEntry key={entry.release.id} {...entry} open={index === 0} />
      ))}
    </ul>
  );
}

const GENERIC_UPDATE_LINE = 'Install it to get the latest version.';

/** What the section can show without the log: the release this app was built as, if it knows. */
const installedOnly = (release: Release | undefined): MarkedRelease[] => (release ? [{ release, marker: 'installed' }] : []);

/** What the card knows of the log: still loading, unusable (failed, or without this release), or the releases newer than this one. */
type Newer = 'loading' | 'unknown' | Release[];

function UpdateCardBody({ waiting, newer }: { waiting: boolean; newer: Newer }) {
  if (waiting) {
    const titles = typeof newer === 'string' ? [] : newer.map((release) => release.title);
    const line = titles.length > 0 ? `It brings: ${titles.join(', ')}.` : GENERIC_UPDATE_LINE;
    return (
      <>
        <p class="whats-new__headline">An update is ready.</p>
        {newer !== 'loading' && <p>{line}</p>}
        <button type="button" class="whats-new__update" onClick={applyUpdate}>
          Update now
        </button>
      </>
    );
  }
  if (newer === 'loading') return <p>Checking for updates…</p>;
  if (newer === 'unknown') return <p class="whats-new__headline">No update is waiting on this device.</p>;
  if (newer.length > 0) {
    return (
      <>
        <p class="whats-new__headline">Nothing to install yet.</p>
        <p>A newer release is still on its way to this device. Check back soon.</p>
      </>
    );
  }
  return (
    <>
      <p class="whats-new__headline">You're up to date.</p>
      {INSTALLED_RELEASE && <p>Installed release: {formatDay(INSTALLED_RELEASE.date)}.</p>}
    </>
  );
}

/**
 * The one place an update is applied. "Update now" is offered exactly when a version is waiting, even before
 * the log has loaded or when it never does; the log only decides the line that comes with it.
 */
function UpdateCard(props: { waiting: boolean; newer: Newer }) {
  return (
    <section class="whats-new__card" data-testid="update-card">
      <UpdateCardBody {...props} />
    </section>
  );
}

function WhatsNew() {
  const log = useLoad(fetchReleases, []);
  const waiting = useUpdateReady();

  const marked = markReleases(log.status === 'ready' ? log.value : undefined, INSTALLED_RELEASE_ID);
  let newer: Newer = 'unknown';
  if (log.status === 'loading') newer = 'loading';
  else if (marked) newer = marked.filter((entry) => entry.marker === 'update-available').map((entry) => entry.release);

  return (
    <>
      <UpdateCard waiting={waiting} newer={newer} />
      {log.status === 'loading' && <p>Loading…</p>}
      {log.status !== 'loading' && marked && <ReleaseList entries={marked} />}
      {log.status !== 'loading' && !marked && (
        <>
          <p class="whats-new__problem">Couldn't load the latest notes.</p>
          <ReleaseList entries={installedOnly(INSTALLED_RELEASE)} />
        </>
      )}
    </>
  );
}

export const section: ParentSection = {
  id: 'whats-new',
  title: "What's new",
  icon: '✨',
  order: 65,
  useAttention: useUpdateReady,
  Component: WhatsNew,
};
