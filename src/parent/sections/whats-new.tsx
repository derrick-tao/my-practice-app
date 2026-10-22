// Parent area section: the release log, under a card that applies a waiting update. Every release, newest first
// (the newest open, older ones folded to title and date), with the one this app is marked "Installed" and any
// above it "Update available". The log
// is read network first (so an old app can preview a newer release's notes) and falls back to the last copy
// the device saw; with no log at all the section shows the installed release and says the notes did not load.
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

/** What the section can show without the log: the release this app was built as, if it knows. */
const installedOnly = (release: Release | undefined): MarkedRelease[] => (release ? [{ release, marker: 'installed' }] : []);

/**
 * The one place an update is applied. "Update now" is offered exactly when a version is waiting, whatever the
 * log says (a failed fetch never blocks an update); the log only decides the line that comes with it.
 *  - waiting, the log ahead of this release: Update now, previewing what the newer releases bring
 *  - waiting, the log has nothing newer (or did not load): Update now with a generic line
 *  - not waiting, the log ahead: the deploy is still installing, nothing to do yet
 *  - not waiting, nothing newer: up to date
 */
function UpdateCard({ waiting, newer }: { waiting: boolean; newer: Release[] }) {
  return (
    <section class="whats-new__card" data-testid="update-card">
      {waiting ? (
        <>
          <p class="whats-new__headline">An update is ready.</p>
          {newer.length > 0 && <p>It brings: {newer.map((release) => release.title).join(', ')}.</p>}
          <button type="button" class="whats-new__update" onClick={applyUpdate}>
            Update now
          </button>
        </>
      ) : newer.length > 0 ? (
        <>
          <p class="whats-new__headline">Nothing to install yet.</p>
          <p>A newer release is still on its way to this device. Check back soon.</p>
        </>
      ) : (
        <>
          <p class="whats-new__headline">You're up to date.</p>
          {INSTALLED_RELEASE && <p>Installed release: {formatDay(INSTALLED_RELEASE.date)}.</p>}
        </>
      )}
    </section>
  );
}

function WhatsNew() {
  const log = useLoad(fetchReleases, []);
  const waiting = useUpdateReady();
  if (log.status === 'loading') return <p>Loading…</p>;

  const marked = markReleases(log.status === 'ready' ? log.value : undefined, INSTALLED_RELEASE_ID);
  const newer = marked?.filter((entry) => entry.marker === 'update-available').map((entry) => entry.release) ?? [];
  return (
    <>
      <UpdateCard waiting={waiting} newer={newer} />
      {marked ? (
        <ReleaseList entries={marked} />
      ) : (
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
